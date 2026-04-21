import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';

export const services = pgTable('services', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  description: text('description').notNull(),
  iconName: text('icon_name'),
  ctaText: text('cta_text'),
  ctaHref: text('cta_href'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  index('services_display_order_idx').on(table.displayOrder),
]);
