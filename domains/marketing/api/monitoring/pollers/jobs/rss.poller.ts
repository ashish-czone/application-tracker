import { Injectable, type OnModuleInit } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { QueueService } from '@packages/queue';
import { DomainEventEmitter } from '@packages/events';
import Parser from 'rss-parser';
import { MonitoringSourcesService } from '../../sources/sources.service';
import { MonitoringItemsService } from '../../items/items.service';
import { POLLER_QUEUES, type PollJobData } from './types';
import {
  MARKETING_MONITORING_SOURCE_POLL_FAILED,
  type MarketingMonitoringSourcePollFailedPayload,
} from '../events/types';

interface RssConfig {
  url: string;
}

const FETCH_TIMEOUT_MS = 10_000;
const BODY_EXCERPT_MAX_CHARS = 1000;

/**
 * RSS / Atom feed poller.
 *
 * Uses the `rss-parser` library which handles RSS 2.0 + Atom + most
 * common edge cases. The dedup key is the feed item's `guid` (or `link`
 * as a fallback).
 */
@Injectable()
export class RssPoller implements OnModuleInit {
  private readonly logger: ContextLogger;
  private readonly parser = new Parser({ timeout: FETCH_TIMEOUT_MS });

  constructor(
    private readonly queue: QueueService,
    private readonly sources: MonitoringSourcesService,
    private readonly items: MonitoringItemsService,
    private readonly events: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(RssPoller.name);
  }

  onModuleInit() {
    this.queue.registerProcessor<PollJobData>({
      name: POLLER_QUEUES.rss,
      handler: (data) => this.execute(data),
    });
  }

  async execute(data: PollJobData): Promise<void> {
    const source = await this.safeFindSource(data.sourceId);
    if (!source || source.kind !== 'rss' || !source.isActive) return;

    try {
      const config = source.configJson as RssConfig;
      const feed = await this.parser.parseURL(config.url);

      for (const entry of feed.items ?? []) {
        const externalId = entry.guid ?? entry.link;
        if (!externalId || !entry.link) continue;

        await this.items.ingestItem(source.id, {
          externalId,
          url: entry.link,
          author: entry.creator ?? (entry as { author?: string }).author ?? null,
          title: entry.title ?? null,
          bodyExcerpt: truncate(stripHtml(entry.contentSnippet ?? entry.content ?? ''), BODY_EXCERPT_MAX_CHARS),
          postedAt: entry.isoDate ? new Date(entry.isoDate) : null,
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
          kind: 'rss',
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
}

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string | undefined | null, maxChars: number): string | null {
  if (!text) return null;
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
