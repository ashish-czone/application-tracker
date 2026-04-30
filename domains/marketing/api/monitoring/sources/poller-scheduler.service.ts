import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { DatabaseService, eq, and, isNull } from '@packages/database';
import { QueueService } from '@packages/queue';
import { marketingMonitoringSources, type MarketingMonitoringSourceRow } from './schema/sources';
import {
  POLLER_QUEUES,
  pollerSchedulerId,
  type PollerQueueName,
} from '../pollers/jobs/types';

const RETRY_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 30_000;

/**
 * Owns the per-source recurring queue schedule.
 *
 * On app boot, scans every active monitoring source and enqueues a
 * recurring poll job for it. After boot, the SourcesService calls
 * `upsertSchedule` / `removeSchedule` whenever a source is created,
 * updated, or soft-deleted — so the live schedule always reflects the
 * current `marketing_monitoring_sources` table.
 *
 * Belongs in the sources module (not pollers) so the dependency direction
 * stays acyclic: pollers → sources, sources → scheduler (same module).
 */
@Injectable()
export class PollerSchedulerService implements OnApplicationBootstrap {
  private readonly logger: ContextLogger;

  constructor(
    private readonly queue: QueueService,
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(PollerSchedulerService.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.MARKETING_POLLER_BOOTSTRAP === 'false') {
      this.logger.log('Poller bootstrap disabled via MARKETING_POLLER_BOOTSTRAP=false');
      return;
    }

    const activeSources = await this.database.db
      .select()
      .from(marketingMonitoringSources)
      .where(
        and(
          eq(marketingMonitoringSources.isActive, true),
          isNull(marketingMonitoringSources.deletedAt),
        ),
      );

    this.logger.log('Bootstrapping poller schedules', { count: activeSources.length });

    for (const source of activeSources) {
      try {
        await this.upsertSchedule(source);
      } catch (error) {
        this.logger.error('Failed to schedule source on bootstrap', {
          sourceId: source.id,
          kind: source.kind,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Idempotently schedules (or re-schedules with new cadence) a source.
   * Called from SourcesService.create / update.
   */
  async upsertSchedule(source: MarketingMonitoringSourceRow): Promise<void> {
    const queueName = this.queueNameForKind(source.kind);
    if (!queueName) {
      this.logger.warn('Skipping schedule — unknown source kind', {
        sourceId: source.id,
        kind: source.kind,
      });
      return;
    }

    if (!source.isActive) {
      // Inactive sources should not have a schedule. Idempotently remove.
      await this.removeSchedule(source.id, source.kind);
      return;
    }

    const everyMs = source.pollingCadenceMinutes * 60 * 1000;
    await this.queue.enqueueRecurring(
      queueName,
      { sourceId: source.id },
      {
        schedulerId: pollerSchedulerId(source.id),
        every: everyMs,
        jobOptions: {
          attempts: RETRY_ATTEMPTS,
          backoff: { type: 'exponential', delay: RETRY_BACKOFF_MS },
        },
      },
    );
  }

  /**
   * Removes the recurring schedule for a source. Called from
   * SourcesService.softDelete and from upsertSchedule when isActive flips
   * to false.
   */
  async removeSchedule(sourceId: string, kind: string): Promise<void> {
    const queueName = this.queueNameForKind(kind);
    if (!queueName) return;
    await this.queue.removeRecurring(queueName, pollerSchedulerId(sourceId));
  }

  private queueNameForKind(kind: string): PollerQueueName | null {
    if (kind === 'reddit') return POLLER_QUEUES.reddit;
    if (kind === 'hackernews') return POLLER_QUEUES.hackernews;
    if (kind === 'rss') return POLLER_QUEUES.rss;
    return null;
  }
}
