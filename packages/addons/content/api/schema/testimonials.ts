import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';

export const testimonials = pgTable('testimonials', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  quote: text('quote').notNull(),
  authorName: text('author_name').notNull(),
  authorRole: text('author_role'),
  companyName: text('company_name'),
  avatarUrl: text('avatar_url'),
  companyLogoUrl: text('company_logo_url'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  index('testimonials_display_order_idx').on(table.displayOrder),
  index('testimonials_is_active_idx').on(table.isActive),
]);
