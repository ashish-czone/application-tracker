import { Module } from '@nestjs/common';
import { MonitoringSourcesModule } from '../sources/sources.module';
import { MonitoringItemsModule } from '../items/items.module';
import { RedditPoller } from './jobs/reddit.poller';
import { HackernewsPoller } from './jobs/hackernews.poller';
import { RssPoller } from './jobs/rss.poller';

/**
 * Registers per-kind queue processors for Reddit / HN / RSS polling.
 * Each poller's onModuleInit registers its processor on QueueService;
 * PollerSchedulerService (in sources/) handles the recurring schedule.
 *
 * Imports sources + items modules so each poller can use their services
 * directly (read source config, ingest matched items, record outcome).
 */
@Module({
  imports: [MonitoringSourcesModule, MonitoringItemsModule],
  providers: [RedditPoller, HackernewsPoller, RssPoller],
  exports: [RedditPoller, HackernewsPoller, RssPoller],
})
export class MonitoringPollersModule {}
