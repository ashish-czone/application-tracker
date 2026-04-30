export { MonitoringSourcesModule } from './sources.module';
export { MonitoringSourcesService } from './sources.service';
export type { PaginatedResult } from './sources.service';
export {
  MARKETING_MONITORING_SOURCE_REGISTERED,
  MARKETING_MONITORING_SOURCE_UPDATED,
  MARKETING_MONITORING_SOURCE_REMOVED,
  type MarketingMonitoringSourceRegisteredPayload,
  type MarketingMonitoringSourceUpdatedPayload,
  type MarketingMonitoringSourceRemovedPayload,
} from './events/types';
export {
  marketingMonitoringSources,
  MONITORING_SOURCE_KINDS,
  type MarketingMonitoringSourceRow,
  type MonitoringSourceKind,
} from './schema/sources';
