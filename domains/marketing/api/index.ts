import type { DomainBackendManifest } from '@packages/domains';
import { MarketingDomainModule } from './marketing.module';

export const marketingBackend: DomainBackendManifest = {
  name: 'marketing',
  displayName: 'Marketing',
  module: MarketingDomainModule,
};

export { MarketingDomainModule };

export {
  MARKETING_PERMISSIONS,
  MONITORING_SOURCES_PERMISSION_MANIFESTS,
  MONITORING_KEYWORDS_PERMISSION_MANIFESTS,
  type MarketingPermission,
} from './permissions';

// Monitoring sources
export {
  MonitoringSourcesService,
  MARKETING_MONITORING_SOURCE_REGISTERED,
  MARKETING_MONITORING_SOURCE_UPDATED,
  MARKETING_MONITORING_SOURCE_REMOVED,
  type MarketingMonitoringSourceRegisteredPayload,
  type MarketingMonitoringSourceUpdatedPayload,
  type MarketingMonitoringSourceRemovedPayload,
  marketingMonitoringSources,
  MONITORING_SOURCE_KINDS,
  type MarketingMonitoringSourceRow,
  type MonitoringSourceKind,
} from './monitoring/sources';

// Monitoring keywords
export {
  MonitoringKeywordsService,
  MARKETING_MONITORING_KEYWORD_REGISTERED,
  MARKETING_MONITORING_KEYWORD_UPDATED,
  MARKETING_MONITORING_KEYWORD_REMOVED,
  type MarketingMonitoringKeywordRegisteredPayload,
  type MarketingMonitoringKeywordUpdatedPayload,
  type MarketingMonitoringKeywordRemovedPayload,
  marketingMonitoringKeywords,
  type MarketingMonitoringKeywordRow,
} from './monitoring/keywords';
