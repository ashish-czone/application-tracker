import { pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const categoryGroups = pgTable('category_groups', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('category_groups_slug_key').on(table.slug),
]);
