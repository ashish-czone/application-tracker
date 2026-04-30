import { Injectable, type OnModuleInit } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { QueueService } from '@packages/queue';
import { DomainEventEmitter } from '@packages/events';
import { MonitoringSourcesService } from '../../sources/sources.service';
import { MonitoringItemsService } from '../../items/items.service';
import { POLLER_QUEUES, type PollJobData } from './types';
import {
  MARKETING_MONITORING_SOURCE_POLL_FAILED,
  type MarketingMonitoringSourcePollFailedPayload,
} from '../events/types';

interface HackernewsConfig {
  query: string;
  tags?: string[];
}

interface AlgoliaHnHit {
  objectID: string;
  title: string | null;
  story_text: string | null;
  comment_text: string | null;
  url: string | null;
  author: string;
  created_at: string;
}

interface AlgoliaHnResponse {
  hits: AlgoliaHnHit[];
}

const HN_API_BASE = 'https://hn.algolia.com/api/v1/search_by_date';
const FETCH_TIMEOUT_MS = 10_000;
const PAGE_LIMIT = 50;
const BODY_EXCERPT_MAX_CHARS = 1000;

/**
 * Hacker News poller.
 *
 * Uses Algolia's HN search API (free, no auth). Configurable per source:
 *   - `query`: the search expression
 *   - `tags`: optional Algolia tag filters (e.g. `story`, `comment`,
 *     `author_<name>`)
 */
@Injectable()
export class HackernewsPoller implements OnModuleInit {
  private readonly logger: ContextLogger;

  constructor(
    private readonly queue: QueueService,
    private readonly sources: MonitoringSourcesService,
    private readonly items: MonitoringItemsService,
    private readonly events: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(HackernewsPoller.name);
  }

  onModuleInit() {
    this.queue.registerProcessor<PollJobData>({
      name: POLLER_QUEUES.hackernews,
      handler: (data) => this.execute(data),
    });
  }

  async execute(data: PollJobData): Promise<void> {
    const source = await this.safeFindSource(data.sourceId);
    if (!source || source.kind !== 'hackernews' || !source.isActive) return;

    try {
      const config = source.configJson as HackernewsConfig;
      const hits = await this.search(config);

      for (const hit of hits) {
        await this.items.ingestItem(source.id, {
          externalId: hit.objectID,
          url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
          author: hit.author,
          title: hit.title,
          bodyExcerpt: truncate(hit.story_text ?? hit.comment_text, BODY_EXCERPT_MAX_CHARS),
          postedAt: new Date(hit.created_at),
        });
      }

      await this.sources.recordPollSuccess(source.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.sources.recordPollError(source.id, message);
      this.events.emit(MARKETING_MONITORING_SOURCE_POLL_FAILED, {
        entityType: 'marketing.monitoring-sources',
        entityId: source.id,
        actorId: null,
        payload: {
          sourceId: source.id,
          kind: 'hackernews',
          errorMessage: message,
          attempts: 1,
        } satisfies MarketingMonitoringSourcePollFailedPayload,
      });
      throw error;
    }
  }

  private async safeFindSource(sourceId: string) {
    try {
      return await this.sources.findOne(sourceId);
    } catch {
      this.logger.warn('Skipping poll — source no longer exists', { sourceId });
      return null;
    }
  }

  private async search(config: HackernewsConfig): Promise<AlgoliaHnHit[]> {
    const url = new URL(HN_API_BASE);
    url.searchParams.set('query', config.query);
    url.searchParams.set('hitsPerPage', String(PAGE_LIMIT));
    if (config.tags && config.tags.length > 0) {
      url.searchParams.set('tags', config.tags.join(','));
    }

    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`HN search failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as AlgoliaHnResponse;
    return body.hits ?? [];
  }
}

async function fetchWithTimeout(url: string | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function truncate(text: string | undefined | null, maxChars: number): string | null {
  if (!text) return null;
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
