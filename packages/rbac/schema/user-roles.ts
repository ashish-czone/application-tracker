import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { users } from '@packages/database';
import { roles } from './roles';

export const userRoles = pgTable('user_roles', {
  userId: text('user_id').notNull().references(() => users.id),
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
]);
