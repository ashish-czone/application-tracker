import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';

export const stats = pgTable('stats', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  label: text('label').notNull(),
  value: integer('value').notNull(),
  suffix: text('suffix'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  index('stats_display_order_idx').on(table.displayOrder),
]);
