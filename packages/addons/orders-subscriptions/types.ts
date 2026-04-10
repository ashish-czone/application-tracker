import type { InferSelectModel } from 'drizzle-orm';
import type { DomainEvent } from '@packages/events';
import type { subscriptionPlans } from './schema/subscription-plans';
import type { subscriptions } from './schema/subscriptions';

// ---------------------------------------------------------------------------
// Record types (inferred from Drizzle schema)
// ---------------------------------------------------------------------------

export type SubscriptionPlanRecord = InferSelectModel<typeof subscriptionPlans>;
export type SubscriptionRecord = InferSelectModel<typeof subscriptions>;

// ---------------------------------------------------------------------------
// Subscription status constants
// ---------------------------------------------------------------------------

export const SUBSCRIPTION_STATUS = {
  PENDING_ACTIVATION: 'pending_activation',
  ACTIVE: 'active',
  PAUSED: 'paused',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

// ---------------------------------------------------------------------------
// Plan interval constants
// ---------------------------------------------------------------------------

export const PLAN_INTERVAL = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  ONE_TIME: 'one_time',
} as const;

export type PlanInterval = (typeof PLAN_INTERVAL)[keyof typeof PLAN_INTERVAL];

// ---------------------------------------------------------------------------
// Capabilities and limits
// ---------------------------------------------------------------------------

export interface PlanCapabilities {
  [key: string]: boolean | string | number;
}

export interface PlanLimits {
  [key: string]: number;
}

export interface AggregatedCapabilities {
  capabilities: Record<string, boolean | string | number>;
  limits: Record<string, number>;
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateSubscriptionInput {
  clientId: string;
  clientType?: string;
  planId: string;
  orderId?: string;
  orderLineItemId?: string;
  metadata?: Record<string, unknown>;
  activateImmediately?: boolean;
}

// ---------------------------------------------------------------------------
// Domain event constants
// ---------------------------------------------------------------------------

export const SUBSCRIPTIONS_ACTIVATED = 'subscriptions.Activated' as const;
export const SUBSCRIPTIONS_RENEWED = 'subscriptions.Renewed' as const;
export const SUBSCRIPTIONS_CANCELLED = 'subscriptions.Cancelled' as const;
export const SUBSCRIPTIONS_PAUSED = 'subscriptions.Paused' as const;
export const SUBSCRIPTIONS_RESUMED = 'subscriptions.Resumed' as const;

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------

export interface SubscriptionActivatedPayload {
  after: Record<string, unknown>;
  planId: string;
  clientId: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  [key: string]: unknown;
}

export interface SubscriptionRenewedPayload {
  subscriptionId: string;
  planId: string;
  clientId: string;
  previousPeriodEnd: string;
  newPeriodEnd: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// EventPayloadMap augmentation
// ---------------------------------------------------------------------------

declare module '@packages/events' {
  interface EventPayloadMap {
    [SUBSCRIPTIONS_ACTIVATED]: SubscriptionActivatedPayload;
    [SUBSCRIPTIONS_RENEWED]: SubscriptionRenewedPayload;
  }
}

// ---------------------------------------------------------------------------
// Domain event interfaces (for consumers)
// ---------------------------------------------------------------------------

export interface SubscriptionActivatedEvent extends DomainEvent {
  eventName: typeof SUBSCRIPTIONS_ACTIVATED;
  entityType: 'subscriptions';
  payload: SubscriptionActivatedPayload;
}

export interface SubscriptionRenewedEvent extends DomainEvent {
  eventName: typeof SUBSCRIPTIONS_RENEWED;
  entityType: 'subscriptions';
  payload: SubscriptionRenewedPayload;
}
