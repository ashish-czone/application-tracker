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

interface RedditConfig {
  subreddit: string;
  sort?: 'new' | 'hot' | 'top' | 'rising';
  timeRange?: 'hour' | 'day' | 'week' | 'month';
}

interface RedditChild {
  data: {
    id: string;
    name: string;
    permalink: string;
    title: string;
    selftext?: string;
    author: string;
    created_utc: number;
    url: string;
  };
}

interface RedditListingResponse {
  data: { children: RedditChild[] };
}

const REDDIT_OAUTH_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_BASE = 'https://oauth.reddit.com';
const FETCH_TIMEOUT_MS = 10_000;
const PAGE_LIMIT = 50;
const TOKEN_SAFETY_MARGIN_MS = 60_000;
const BODY_EXCERPT_MAX_CHARS = 1000;

/**
 * Reddit poller.
 *
 * Fetches the configured subreddit listing using app-only OAuth2
 * (client-credentials grant). Token cached in-process; refreshed when
 * within 60s of expiry.
 *
 * Required env (per Q4 decision): REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET,
 * REDDIT_USER_AGENT.
 */
@Injectable()
export class RedditPoller implements OnModuleInit {
  private readonly logger: ContextLogger;
  private cachedToken: { access_token: string; expires_at: number } | null = null;

  constructor(
    private readonly queue: QueueService,
    private readonly sources: MonitoringSourcesService,
    private readonly items: MonitoringItemsService,
    private readonly events: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(RedditPoller.name);
  }

  onModuleInit() {
    this.queue.registerProcessor<PollJobData>({
      name: POLLER_QUEUES.reddit,
      handler: (data) => this.execute(data),
    });
  }

  async execute(data: PollJobData): Promise<void> {
    const source = await this.safeFindSource(data.sourceId);
    if (!source || source.kind !== 'reddit' || !source.isActive) return;

    try {
      const token = await this.getToken();
      const config = source.configJson as RedditConfig;
      const items = await this.fetchListing(token, config);

      for (const child of items) {
        await this.items.ingestItem(source.id, {
          externalId: child.data.name,
          url: `https://www.reddit.com${child.data.permalink}`,
          author: child.data.author,
          title: child.data.title,
          bodyExcerpt: truncate(child.data.selftext, BODY_EXCERPT_MAX_CHARS),
          postedAt: new Date(child.data.created_utc * 1000),
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
          kind: 'reddit',
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
    } catch (error) {
      this.logger.warn('Skipping poll — source no longer exists', { sourceId });
      return null;
    }
  }

  private async getToken(): Promise<string> {
    if (
      this.cachedToken &&
      this.cachedToken.expires_at > Date.now() + TOKEN_SAFETY_MARGIN_MS
    ) {
      return this.cachedToken.access_token;
    }

    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    const userAgent = process.env.REDDIT_USER_AGENT;
    if (!clientId || !clientSecret || !userAgent) {
      throw new Error(
        'Reddit OAuth env missing: set REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET / REDDIT_USER_AGENT',
      );
    }

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetchWithTimeout(REDDIT_OAUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
      body: 'grant_type=client_credentials&scope=read',
    });
    if (!response.ok) {
      throw new Error(`Reddit token request failed: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as { access_token: string; expires_in: number };
    this.cachedToken = {
      access_token: json.access_token,
      expires_at: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  }

  private async fetchListing(token: string, config: RedditConfig): Promise<RedditChild[]> {
    const sort = config.sort ?? 'new';
    const url = new URL(`${REDDIT_API_BASE}/r/${encodeURIComponent(config.subreddit)}/${sort}`);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    if (config.timeRange) url.searchParams.set('t', config.timeRange);

    const response = await fetchWithTimeout(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': process.env.REDDIT_USER_AGENT ?? 'marketing-poller/1.0',
      },
    });
    if (!response.ok) {
      throw new Error(`Reddit listing request failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as RedditListingResponse;
    return body.data?.children ?? [];
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
