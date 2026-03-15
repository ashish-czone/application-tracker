import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const roles = pgTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  userType: text('user_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex('roles_name_user_type_key').on(table.name, table.userType),
]);
