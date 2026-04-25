import { pgTable, text, integer, jsonb, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { softDeleteColumns } from '@packages/soft-delete';

export const subscriptionPlans = pgTable('subscription_plans', {
  id: text('id').primaryKey().$defaultFn(() => globalThis.crypto.randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  price: integer('price').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  interval: text('interval').notNull().default('monthly'),
  intervalCount: integer('interval_count').notNull().default(1),
  capabilities: jsonb('capabilities'),
  limits: jsonb('limits'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  uniqueIndex('subscription_plans_slug_unique').on(table.slug).where(sql`deleted_at IS NULL`),
  index('subscription_plans_is_active_idx').on(table.isActive),
  index('subscription_plans_sort_order_idx').on(table.sortOrder),
]);
