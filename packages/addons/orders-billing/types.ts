import type { InferSelectModel } from 'drizzle-orm';
import type { DomainEvent } from '@packages/events';
import type { orders } from './schema/orders';
import type { orderLineItems } from './schema/order-line-items';

// ---------------------------------------------------------------------------
// Product interface — consuming apps implement this to make things purchasable
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  name: string;
  description?: string;
  unitPrice: number;
  currency: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface ProductResolver {
  resolve(productId: string): Promise<Product | null>;
}

// ---------------------------------------------------------------------------
// BillingClient interface — consuming apps implement this for buyer identity
// ---------------------------------------------------------------------------

export interface BillingClient {
  id: string;
  name: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingClientResolver {
  resolve(clientId: string): Promise<BillingClient | null>;
}

// ---------------------------------------------------------------------------
// Order lifecycle hooks — consuming apps register these for creation logic
// ---------------------------------------------------------------------------

export interface OrderLifecycleHooks {
  beforeCreate?(input: CreateOrderInput): Promise<CreateOrderInput>;
  afterCreate?(order: OrderRecord): Promise<void>;
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface CreateLineItemInput {
  productId: string;
  productType: string;
  description?: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface CreateOrderInput {
  clientId: string;
  clientType?: string;
  currency: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  lineItems: CreateLineItemInput[];
}

export interface AddLineItemInput {
  productId: string;
  productType: string;
  description?: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Record types (inferred from Drizzle schema)
// ---------------------------------------------------------------------------

export type OrderRecord = InferSelectModel<typeof orders>;
export type OrderLineItemRecord = InferSelectModel<typeof orderLineItems>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ORDER_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// ---------------------------------------------------------------------------
// Domain event constants
// ---------------------------------------------------------------------------

export const ORDERS_ORDER_CREATED = 'orders.OrderCreated' as const;

export interface OrderCreatedPayload {
  after: Record<string, unknown>;
  lineItems: Array<{
    productId: string;
    productType: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  [key: string]: unknown;
}

declare module '@packages/events' {
  interface EventPayloadMap {
    [ORDERS_ORDER_CREATED]: OrderCreatedPayload;
  }
}

export interface OrderCreatedEvent extends DomainEvent {
  eventName: typeof ORDERS_ORDER_CREATED;
  entityType: 'orders';
  payload: OrderCreatedPayload;
}
