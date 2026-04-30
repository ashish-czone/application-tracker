/**
 * Domain events emitted from MonitoringSourcesService after writes.
 *
 * Audit / automations / analytics subscribe via DomainEventEmitter; this
 * domain has no opinion on who reacts.
 */

export const MARKETING_MONITORING_SOURCE_REGISTERED =
  'marketing.MonitoringSourceRegistered' as const;
export const MARKETING_MONITORING_SOURCE_UPDATED =
  'marketing.MonitoringSourceUpdated' as const;
export const MARKETING_MONITORING_SOURCE_REMOVED =
  'marketing.MonitoringSourceRemoved' as const;

export interface MarketingMonitoringSourceRegisteredPayload extends Record<string, unknown> {
  sourceId: string;
  kind: string;
  label: string;
  pollingCadenceMinutes: number;
}

export interface MarketingMonitoringSourceUpdatedPayload extends Record<string, unknown> {
  sourceId: string;
  changes: Record<string, unknown>;
}

export interface MarketingMonitoringSourceRemovedPayload extends Record<string, unknown> {
  sourceId: string;
  kind: string;
  label: string;
}

// --- Augment global EventPayloadMap for compile-time safety ---

declare module '@packages/events' {
  interface EventPayloadMap {
    [MARKETING_MONITORING_SOURCE_REGISTERED]: MarketingMonitoringSourceRegisteredPayload;
    [MARKETING_MONITORING_SOURCE_UPDATED]: MarketingMonitoringSourceUpdatedPayload;
    [MARKETING_MONITORING_SOURCE_REMOVED]: MarketingMonitoringSourceRemovedPayload;
  }
}
