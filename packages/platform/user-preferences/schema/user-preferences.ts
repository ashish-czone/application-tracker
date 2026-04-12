import { pgTable, text, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const userPreferences = pgTable('user_preferences', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  userId: text('user_id').notNull(),
  namespace: text('namespace').notNull(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('user_preferences_user_ns_key_unique').on(table.userId, table.namespace, table.key),
  index('user_preferences_user_ns_idx').on(table.userId, table.namespace),
]);
