import { pgTable, text, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const settings = pgTable('settings', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  module: text('module').notNull(),
  key: text('key').notNull(),
  value: jsonb('value').notNull(),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('settings_module_key_key').on(table.module, table.key),
  index('settings_module_idx').on(table.module),
]);
