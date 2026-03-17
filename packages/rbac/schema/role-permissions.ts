import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { roles } from './roles';

export const rolePermissions = pgTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permission: text('permission').notNull(),
  scope: text('scope').notNull().default('all'),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permission] }),
]);
