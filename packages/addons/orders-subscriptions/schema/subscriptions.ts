import { pgTable, text, integer, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { softDeleteColumns } from '@packages/soft-delete';
import { subscriptionPlans } from './subscription-plans';

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  clientId: text('client_id').notNull(),
  clientType: text('client_type'),
  planId: text('plan_id').notNull().references(() => subscriptionPlans.id),
  planSnapshot: jsonb('plan_snapshot').notNull(),
  orderId: text('order_id'),
  orderLineItemId: text('order_line_item_id'),
  status: text('status').notNull().default('pending_activation'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true, mode: 'date' }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true, mode: 'date' }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
  autoRenew: boolean('auto_renew').notNull().default(true),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  index('subscriptions_client_id_idx').on(table.clientId),
  index('subscriptions_plan_id_idx').on(table.planId),
  index('subscriptions_status_idx').on(table.status),
  index('subscriptions_current_period_end_idx').on(table.currentPeriodEnd),
  index('subscriptions_order_id_idx').on(table.orderId),
]);
