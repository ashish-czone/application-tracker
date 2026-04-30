import { Module } from '@nestjs/common';
import { MonitoringSourcesModule } from './sources/sources.module';
import { MonitoringKeywordsModule } from './keywords/keywords.module';
import { MonitoringItemsModule } from './items/items.module';
import { MonitoringPollersModule } from './pollers/pollers.module';

/**
 * Composes all monitoring-feature modules: sources, keywords, items + ingestion,
 * and per-kind poller jobs (Reddit / HN / RSS).
 *
 * Each sub-module owns its RBAC manifests. The pollers module imports sources
 * + items so each per-kind poller can fetch source config, ingest matches,
 * and record poll outcomes; sources hosts the PollerSchedulerService which
 * owns the per-source recurring queue schedule.
 */
@Module({
  imports: [
    MonitoringSourcesModule,
    MonitoringKeywordsModule,
    MonitoringItemsModule,
    MonitoringPollersModule,
  ],
  exports: [
    MonitoringSourcesModule,
    MonitoringKeywordsModule,
    MonitoringItemsModule,
    MonitoringPollersModule,
  ],
})
export class MonitoringModule {}
