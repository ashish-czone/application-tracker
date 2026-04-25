import { pgTable, text, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { softDeleteColumns } from '@packages/soft-delete';

export const orders = pgTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => globalThis.crypto.randomUUID()),
  orderNumber: text('order_number').notNull(),
  status: text('status').notNull().default('draft'),
  clientId: text('client_id').notNull(),
  clientType: text('client_type'),
  totalAmount: integer('total_amount').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  uniqueIndex('orders_order_number_unique').on(table.orderNumber).where(sql`deleted_at IS NULL`),
  index('orders_status_idx').on(table.status),
  index('orders_client_id_idx').on(table.clientId),
  index('orders_created_at_idx').on(table.createdAt),
  index('orders_expires_at_idx').on(table.expiresAt),
]);
