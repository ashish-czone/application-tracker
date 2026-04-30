import { Module } from '@nestjs/common';
import { MonitoringSourcesModule } from './sources/sources.module';
import { MonitoringKeywordsModule } from './keywords/keywords.module';
import { MonitoringItemsModule } from './items/items.module';

/**
 * Composes all monitoring-feature modules: sources, keywords, items + ingestion,
 * and per-kind poller jobs (V1, M1.4). Each sub-module owns its RBAC manifests
 * and is independently importable.
 */
@Module({
  imports: [MonitoringSourcesModule, MonitoringKeywordsModule, MonitoringItemsModule],
  exports: [MonitoringSourcesModule, MonitoringKeywordsModule, MonitoringItemsModule],
})
export class MonitoringModule {}
