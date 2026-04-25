import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { tagGroups } from './tag-groups';

export const tags = pgTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  tagGroupId: text('tag_group_id').notNull().references(() => tagGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  color: text('color'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('tags_slug_tag_group_id_key').on(table.slug, table.tagGroupId),
]);
