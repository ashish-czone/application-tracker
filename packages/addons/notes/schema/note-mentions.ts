import { randomUUID } from 'node:crypto';
import { pgTable, text, timestamp, index, unique } from 'drizzle-orm/pg-core';
import { users } from '@packages/database/schema';
import { notes } from './notes';

export const noteMentions = pgTable('note_mentions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  noteId: text('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  unique('note_mentions_note_user_unique').on(table.noteId, table.userId),
  index('note_mentions_note_id_idx').on(table.noteId),
  index('note_mentions_user_id_idx').on(table.userId),
]);
