/**
 * Events emitted by MonitoringItemsService.
 *
 * INGESTED fires only when a NEW item is stored (deduped fetches do not
 * re-fire). The inbox-action events (ENGAGED/DISMISSED/SNOOZED/CONVERTED)
 * fire on every operator-initiated transition.
 */

export const MARKETING_MONITORING_ITEM_INGESTED =
  'marketing.MonitoringItemIngested' as const;
export const MARKETING_MONITORING_ITEM_ENGAGED =
  'marketing.MonitoringItemEngaged' as const;
export const MARKETING_MONITORING_ITEM_DISMISSED =
  'marketing.MonitoringItemDismissed' as const;
export const MARKETING_MONITORING_ITEM_SNOOZED =
  'marketing.MonitoringItemSnoozed' as const;
export const MARKETING_MONITORING_ITEM_CONVERTED_TO_LEAD =
  'marketing.MonitoringItemConvertedToLead' as const;

export interface MarketingMonitoringItemIngestedPayload extends Record<string, unknown> {
  itemId: string;
  sourceId: string;
  externalId: string;
  url: string;
  matchedKeywordIds: string[];
}

export interface MarketingMonitoringItemEngagedPayload extends Record<string, unknown> {
  itemId: string;
  sourceId: string;
  url: string;
  note?: string;
}

export interface MarketingMonitoringItemDismissedPayload extends Record<string, unknown> {
  itemId: string;
  sourceId: string;
  url: string;
  note?: string;
}

export interface MarketingMonitoringItemSnoozedPayload extends Record<string, unknown> {
  itemId: string;
  sourceId: string;
  url: string;
  snoozedUntil: string;
  note?: string;
}

export interface MarketingMonitoringItemConvertedToLeadPayload extends Record<string, unknown> {
  itemId: string;
  sourceId: string;
  url: string;
}

declare module '@packages/events' {
  interface EventPayloadMap {
    [MARKETING_MONITORING_ITEM_INGESTED]: MarketingMonitoringItemIngestedPayload;
    [MARKETING_MONITORING_ITEM_ENGAGED]: MarketingMonitoringItemEngagedPayload;
    [MARKETING_MONITORING_ITEM_DISMISSED]: MarketingMonitoringItemDismissedPayload;
    [MARKETING_MONITORING_ITEM_SNOOZED]: MarketingMonitoringItemSnoozedPayload;
    [MARKETING_MONITORING_ITEM_CONVERTED_TO_LEAD]: MarketingMonitoringItemConvertedToLeadPayload;
  }
}
