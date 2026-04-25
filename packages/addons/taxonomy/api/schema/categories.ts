import { pgTable, text, timestamp, integer, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';
import { categoryGroups } from './category-groups';
import { hierarchyColumns } from '@packages/hierarchy/schema';

export const categories = pgTable('categories', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  groupId: text('group_id').notNull().references(() => categoryGroups.id, { onDelete: 'cascade' }),
  ...hierarchyColumns(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('categories_slug_group_id_parent_id_key').on(table.slug, table.groupId, table.parentId),
  index('categories_group_id_idx').on(table.groupId),
  index('categories_parent_id_idx').on(table.parentId),
  index('categories_path_idx').on(table.path),
]);
