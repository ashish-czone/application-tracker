import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';

export const faqItems = pgTable('faq_items', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: text('category'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
  ...softDeleteColumns(),
}, (table) => [
  index('faq_items_display_order_idx').on(table.displayOrder),
  index('faq_items_category_idx').on(table.category),
]);
