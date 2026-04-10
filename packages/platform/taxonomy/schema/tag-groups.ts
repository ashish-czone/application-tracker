import { pgTable, text, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const tagGroups = pgTable('tag_groups', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  allowMultiple: boolean('allow_multiple').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('tag_groups_slug_key').on(table.slug),
]);
