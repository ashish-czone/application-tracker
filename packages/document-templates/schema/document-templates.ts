import { pgTable, text, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { users } from '@packages/database/schema';

export const documentTemplates = pgTable('document_templates', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  category: text('category').notNull(),
  subject: text('subject'),
  htmlBody: text('html_body').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  metadata: jsonb('metadata'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  index('document_templates_category_idx').on(table.category),
]);
