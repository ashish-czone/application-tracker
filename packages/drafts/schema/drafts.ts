import { randomUUID } from 'node:crypto';
import { pgTable, text, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from '@packages/database/schema';

export const drafts = pgTable('drafts', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  entityType: text('entity_type').notNull(),
  draftKey: text('draft_key').notNull(),
  data: jsonb('data').notNull(),
  createdById: text('created_by_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('drafts_user_entity_key_idx').on(table.createdById, table.entityType, table.draftKey),
  index('drafts_entity_type_idx').on(table.entityType),
  index('drafts_created_by_id_idx').on(table.createdById),
]);
