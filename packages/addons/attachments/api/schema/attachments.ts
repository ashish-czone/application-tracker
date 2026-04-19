import { randomUUID } from 'node:crypto';
import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from '@packages/database/schema';

export const attachments = pgTable('attachments', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fileKey: text('file_key').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
}, (table) => [
  index('attachments_entity_lookup_idx').on(table.entityType, table.entityId),
  index('attachments_uploaded_by_idx').on(table.uploadedBy),
  index('attachments_created_at_idx').on(table.createdAt),
]);
