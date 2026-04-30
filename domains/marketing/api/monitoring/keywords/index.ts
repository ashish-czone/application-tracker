export { MonitoringKeywordsModule } from './keywords.module';
export { MonitoringKeywordsService } from './keywords.service';
export type { PaginatedResult } from './keywords.service';
export {
  MARKETING_MONITORING_KEYWORD_REGISTERED,
  MARKETING_MONITORING_KEYWORD_UPDATED,
  MARKETING_MONITORING_KEYWORD_REMOVED,
  type MarketingMonitoringKeywordRegisteredPayload,
  type MarketingMonitoringKeywordUpdatedPayload,
  type MarketingMonitoringKeywordRemovedPayload,
} from './events/types';
export {
  marketingMonitoringKeywords,
  type MarketingMonitoringKeywordRow,
} from './schema/keywords';
