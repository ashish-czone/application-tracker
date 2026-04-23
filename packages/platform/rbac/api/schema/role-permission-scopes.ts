import { pgTable, text, jsonb, primaryKey, foreignKey } from 'drizzle-orm/pg-core';
import { rolePermissions } from './role-permissions';

export const rolePermissionScopes = pgTable('role_permission_scopes', {
  roleId: text('role_id').notNull(),
  permission: text('permission').notNull(),
  scopeType: text('scope_type').notNull(),
  scopeParams: jsonb('scope_params'),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permission, table.scopeType] }),
  foreignKey({
    columns: [table.roleId, table.permission],
    foreignColumns: [rolePermissions.roleId, rolePermissions.permission],
    name: 'role_permission_scopes_grant_fk',
  }).onDelete('cascade'),
]);
