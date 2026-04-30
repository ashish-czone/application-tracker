import { Module } from '@nestjs/common';
import { MonitoringSourcesModule } from './sources/sources.module';

/**
 * Composes all monitoring-feature modules: sources (V1), keywords (V1, M1.2),
 * items + ingestion (V1, M1.3), and per-kind poller jobs (V1, M1.4).
 *
 * V1 currently exposes only the sources sub-module — additional sub-modules
 * land in follow-up PRs without changing this composition file's shape.
 */
@Module({
  imports: [MonitoringSourcesModule],
  exports: [MonitoringSourcesModule],
})
export class MonitoringModule {}
