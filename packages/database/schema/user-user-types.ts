import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userUserTypes = pgTable('user_user_types', {
  userId: text('user_id').notNull().references(() => users.id),
  userType: text('user_type').notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.userType] }),
]);
