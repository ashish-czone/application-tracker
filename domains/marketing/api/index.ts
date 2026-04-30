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
  MONITORING_ITEMS_PERMISSION_MANIFESTS,
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

// Monitoring items
export {
  MonitoringItemsService,
  type RawMonitoringItem,
  MARKETING_MONITORING_ITEM_INGESTED,
  MARKETING_MONITORING_ITEM_ENGAGED,
  MARKETING_MONITORING_ITEM_DISMISSED,
  MARKETING_MONITORING_ITEM_SNOOZED,
  MARKETING_MONITORING_ITEM_CONVERTED_TO_LEAD,
  type MarketingMonitoringItemIngestedPayload,
  type MarketingMonitoringItemEngagedPayload,
  type MarketingMonitoringItemDismissedPayload,
  type MarketingMonitoringItemSnoozedPayload,
  type MarketingMonitoringItemConvertedToLeadPayload,
  marketingMonitoringItems,
  MONITORING_ITEM_STATUSES,
  type MarketingMonitoringItemRow,
  type MonitoringItemStatus,
} from './monitoring/items';

// Monitoring pollers (queue-backed Reddit / HN / RSS pollers + scheduler)
export { PollerSchedulerService } from './monitoring/sources/poller-scheduler.service';
export {
  RedditPoller,
  HackernewsPoller,
  RssPoller,
  POLLER_QUEUES,
  pollerSchedulerId,
  MARKETING_MONITORING_SOURCE_POLL_FAILED,
  type PollJobData,
  type PollerQueueName,
  type MarketingMonitoringSourcePollFailedPayload,
} from './monitoring/pollers';
