/**
 * Domain events emitted from MonitoringKeywordsService after writes.
 * Audit / automations / analytics subscribe via DomainEventEmitter.
 */

export const MARKETING_MONITORING_KEYWORD_REGISTERED =
  'marketing.MonitoringKeywordRegistered' as const;
export const MARKETING_MONITORING_KEYWORD_UPDATED =
  'marketing.MonitoringKeywordUpdated' as const;
export const MARKETING_MONITORING_KEYWORD_REMOVED =
  'marketing.MonitoringKeywordRemoved' as const;

export interface MarketingMonitoringKeywordRegisteredPayload extends Record<string, unknown> {
  keywordId: string;
  sourceId: string;
  phrase: string;
  isRegex: boolean;
}

export interface MarketingMonitoringKeywordUpdatedPayload extends Record<string, unknown> {
  keywordId: string;
  sourceId: string;
  changes: Record<string, unknown>;
}

export interface MarketingMonitoringKeywordRemovedPayload extends Record<string, unknown> {
  keywordId: string;
  sourceId: string;
  phrase: string;
}

declare module '@packages/events' {
  interface EventPayloadMap {
    [MARKETING_MONITORING_KEYWORD_REGISTERED]: MarketingMonitoringKeywordRegisteredPayload;
    [MARKETING_MONITORING_KEYWORD_UPDATED]: MarketingMonitoringKeywordUpdatedPayload;
    [MARKETING_MONITORING_KEYWORD_REMOVED]: MarketingMonitoringKeywordRemovedPayload;
  }
}
