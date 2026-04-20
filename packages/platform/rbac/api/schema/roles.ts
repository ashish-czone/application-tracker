import { pgTable, text, timestamp, uniqueIndex, boolean } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const roles = pgTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  userType: text('user_type'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('roles_name_key').on(table.name),
]);
