import type { DrizzleDB } from '@packages/database';
import {
  roles,
  permissions,
  rolePermissions,
  identityRoles,
  eq,
  and,
  asc,
  desc,
} from '@packages/database';
import type {
  RoleDelegate,
  PermissionDelegate,
  RolePermissionDelegate,
  IdentityRoleDelegate,
} from '@packages/rbac';

export function createRoleDelegate(db: DrizzleDB): RoleDelegate {
  return {
    async findById(id) {
      const [result] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
      return result ?? null;
    },
    async findByName(name) {
      const [result] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
      return result ?? null;
    },
    async findAll(orderBy) {
      const direction = orderBy?.direction === 'desc' ? desc : asc;
      const field = orderBy?.field === 'name' ? roles.name : roles.createdAt;
      return db.select().from(roles).orderBy(direction(field));
    },
    async create(data) {
      const [result] = await db.insert(roles).values(data).returning();
      return result;
    },
    async update(id, data) {
      const [result] = await db.update(roles).set(data).where(eq(roles.id, id)).returning();
      return result;
    },
    async delete(id) {
      await db.delete(roles).where(eq(roles.id, id));
    },
  };
}

export function createPermissionDelegate(db: DrizzleDB): PermissionDelegate {
  return {
    async findAll(orderBy) {
      const direction = orderBy?.direction === 'desc' ? desc : asc;
      const field = orderBy?.field === 'resource' ? permissions.resource : permissions.createdAt;
      return db.select().from(permissions).orderBy(direction(field));
    },
    async upsert(data) {
      const [existing] = await db
        .select()
        .from(permissions)
        .where(and(eq(permissions.resource, data.resource), eq(permissions.action, data.action)))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(permissions)
          .set({ description: data.description })
          .where(eq(permissions.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db.insert(permissions).values(data).returning();
      return created;
    },
  };
}

export function createRolePermissionDelegate(db: DrizzleDB): RolePermissionDelegate {
  return {
    async findByRoleId(roleId) {
      const results = await db
        .select({
          roleId: rolePermissions.roleId,
          permissionId: rolePermissions.permissionId,
          createdAt: rolePermissions.createdAt,
          permission: {
            id: permissions.id,
            resource: permissions.resource,
            action: permissions.action,
            description: permissions.description,
            createdAt: permissions.createdAt,
          },
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, roleId));
      return results;
    },
    async setForRole(roleId, permissionIds) {
      await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      if (permissionIds.length > 0) {
        await db.insert(rolePermissions).values(
          permissionIds.map((permissionId) => ({ roleId, permissionId })),
        ).onConflictDoNothing();
      }
    },
  };
}

export function createIdentityRoleDelegate(db: DrizzleDB): IdentityRoleDelegate {
  return {
    async findByIdentityId(identityId) {
      const results = await db
        .select({
          identityId: identityRoles.identityId,
          roleId: identityRoles.roleId,
          createdAt: identityRoles.createdAt,
          role: {
            id: roles.id,
            name: roles.name,
            description: roles.description,
            createdAt: roles.createdAt,
            updatedAt: roles.updatedAt,
          },
        })
        .from(identityRoles)
        .innerJoin(roles, eq(identityRoles.roleId, roles.id))
        .where(eq(identityRoles.identityId, identityId));
      return results;
    },
    async findRoleIdsByIdentityId(identityId) {
      const results = await db
        .select({ roleId: identityRoles.roleId })
        .from(identityRoles)
        .where(eq(identityRoles.identityId, identityId));
      return results.map((r) => r.roleId);
    },
    async create(data) {
      const [result] = await db.insert(identityRoles).values(data).returning();
      return result;
    },
    async delete(identityId, roleId) {
      await db
        .delete(identityRoles)
        .where(and(eq(identityRoles.identityId, identityId), eq(identityRoles.roleId, roleId)));
    },
  };
}
