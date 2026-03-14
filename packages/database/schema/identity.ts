import { pgTable, text, timestamp, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { randomUUID } from 'crypto';

export const identities = pgTable('identities', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  refreshToken: text('refreshToken'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const passwordTokens = pgTable('password_tokens', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  identityId: text('identityId').notNull().references(() => identities.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expiresAt', { withTimezone: true, mode: 'date' }).notNull(),
  usedAt: timestamp('usedAt', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const roles = pgTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const permissions = pgTable('permissions', {
  id: text('id').primaryKey().$defaultFn(() => randomUUID()),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  description: text('description'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('permissions_resource_action_key').on(table.resource, table.action),
]);

export const rolePermissions = pgTable('role_permissions', {
  roleId: text('roleId').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: text('permissionId').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] }),
]);

export const identityRoles = pgTable('identity_roles', {
  identityId: text('identityId').notNull().references(() => identities.id, { onDelete: 'cascade' }),
  roleId: text('roleId').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.identityId, table.roleId] }),
]);
