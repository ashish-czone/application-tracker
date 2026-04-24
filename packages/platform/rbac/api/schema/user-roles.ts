import { pgTable, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { roles } from './roles';

export const userRoles = pgTable('user_roles', {
  userId: text('user_id').notNull(),
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
]);
