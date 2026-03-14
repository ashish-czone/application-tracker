import { relations } from 'drizzle-orm';
import { identities, passwordTokens, roles, permissions, rolePermissions, identityRoles } from './identity';
import { users } from './users';

export const identitiesRelations = relations(identities, ({ many, one }) => ({
  passwordTokens: many(passwordTokens),
  identityRoles: many(identityRoles),
  user: one(users, { fields: [identities.id], references: [users.identityId] }),
}));

export const passwordTokensRelations = relations(passwordTokens, ({ one }) => ({
  identity: one(identities, { fields: [passwordTokens.identityId], references: [identities.id] }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  identityRoles: many(identityRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const identityRolesRelations = relations(identityRoles, ({ one }) => ({
  identity: one(identities, { fields: [identityRoles.identityId], references: [identities.id] }),
  role: one(roles, { fields: [identityRoles.roleId], references: [roles.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  identity: one(identities, { fields: [users.identityId], references: [identities.id] }),
}));
