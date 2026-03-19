import { pgTable, text, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { tags } from './tags';

export const entityTags = pgTable('entity_tags', {
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.entityType, table.entityId, table.tagId] }),
  index('entity_tags_entity_lookup_idx').on(table.entityType, table.entityId),
  index('entity_tags_tag_id_idx').on(table.tagId),
]);
