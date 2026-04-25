import { pgTable, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { orders } from './orders';

export const orderLineItems = pgTable('order_line_items', {
  id: text('id').primaryKey().$defaultFn(() => globalThis.crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  productType: text('product_type').notNull(),
  productSnapshot: jsonb('product_snapshot').notNull(),
  description: text('description'),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull(),
  totalPrice: integer('total_price').notNull(),
  metadata: jsonb('metadata'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  index('order_line_items_order_id_idx').on(table.orderId),
  index('order_line_items_product_type_idx').on(table.productType),
]);
