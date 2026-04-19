import { randomUUID } from 'node:crypto';
import { pgTable, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from '@packages/database/schema';

export const notes = pgTable('notes', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  content: text('content').notNull(),
  isInternal: boolean('is_internal').notNull().default(true),
  authorId: text('author_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('notes_entity_lookup_idx').on(table.entityType, table.entityId),
  index('notes_author_id_idx').on(table.authorId),
  index('notes_created_at_idx').on(table.createdAt),
]);
