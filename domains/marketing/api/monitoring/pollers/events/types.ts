/**
 * Emitted from a poller when an external fetch attempt exhausts BullMQ
 * retries. Audit / automations / future "operator alert" listeners can
 * subscribe.
 *
 * Note: the existing source CRUD events (REGISTERED/UPDATED/REMOVED) live
 * in monitoring/sources/events/types.ts. Poll outcomes are operational —
 * they belong to the pollers module, not to the source-lifecycle module.
 */

export const MARKETING_MONITORING_SOURCE_POLL_FAILED =
  'marketing.MonitoringSourcePollFailed' as const;

export interface MarketingMonitoringSourcePollFailedPayload extends Record<string, unknown> {
  sourceId: string;
  kind: string;
  errorMessage: string;
  /** Total attempts made by BullMQ before exhausting retries. */
  attempts: number;
}

declare module '@packages/events' {
  interface EventPayloadMap {
    [MARKETING_MONITORING_SOURCE_POLL_FAILED]: MarketingMonitoringSourcePollFailedPayload;
  }
}
