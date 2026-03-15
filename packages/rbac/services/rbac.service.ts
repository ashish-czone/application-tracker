import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, and, inArray, type DrizzleDB } from '@packages/database';
import { userUserTypes } from '@packages/database';
import { roles } from '../schema/roles';
import { permissions } from '../schema/permissions';
import { rolePermissions } from '../schema/role-permissions';
import { userRoles } from '../schema/user-roles';
import { PermissionRegistryService } from './permission-registry.service';
import type { Role, Permission } from '../types';

@Injectable()
export class RbacService {
  constructor(
    private readonly database: DatabaseService,
    private readonly permissionRegistry: PermissionRegistryService,
  ) {}

  // --- Roles ---

  async createRole(data: { name: string; userType: string }): Promise<Role> {
    const [role] = await this.database.db
      .insert(roles)
      .values(data)
      .returning();
    return role;
  }

  async updateRole(id: string, data: { name: string }): Promise<Role> {
    const [role] = await this.database.db
      .update(roles)
      .set(data)
      .where(eq(roles.id, id))
      .returning();

    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async deleteRole(id: string): Promise<void> {
    const [role] = await this.database.db
      .delete(roles)
      .where(eq(roles.id, id))
      .returning();

    if (!role) throw new NotFoundException('Role not found');
  }

  async findRoleById(id: string): Promise<Role | null> {
    const [role] = await this.database.db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);

    return role ?? null;
  }

  async findRolesByUserType(userType: string): Promise<Role[]> {
    return this.database.db
      .select()
      .from(roles)
      .where(eq(roles.userType, userType));
  }

  // --- Permissions ---

  async getPermissionsForUser(userId: string, userType: string): Promise<string[]> {
    const results = await this.database.db
      .select({ name: permissions.name })
      .from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.userType, userType)))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(userRoles.userId, userId));

    return [...new Set(results.map((r) => r.name))];
  }

  async setRolePermissions(roleId: string, permissionNames: string[]): Promise<void> {
    const role = await this.findRoleById(roleId);
    if (!role) throw new NotFoundException('Role not found');

    // Ensure all permissions exist in DB, create missing ones
    const permissionRecords = await this.ensurePermissionsExist(permissionNames);

    // Replace: delete existing, insert new
    await this.database.db
      .delete(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));

    if (permissionRecords.length > 0) {
      await this.database.db
        .insert(rolePermissions)
        .values(permissionRecords.map((p) => ({ roleId, permissionId: p.id })));
    }
  }

  async getRolePermissions(roleId: string): Promise<string[]> {
    const results = await this.database.db
      .select({ name: permissions.name })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(rolePermissions.roleId, roleId));

    return results.map((r) => r.name);
  }

  // --- User-role assignment ---

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    const role = await this.findRoleById(roleId);
    if (!role) throw new NotFoundException('Role not found');

    // Validate user has the matching user type
    const types = await this.getUserTypes(userId);
    if (!types.includes(role.userType)) {
      throw new ConflictException(
        `Cannot assign role scoped to '${role.userType}' — user does not have this type`,
      );
    }

    await this.database.db
      .insert(userRoles)
      .values({ userId, roleId })
      .onConflictDoNothing();
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await this.database.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
  }

  async getUserRoles(userId: string, userType?: string): Promise<Role[]> {
    const conditions = [eq(userRoles.userId, userId)];
    if (userType) {
      conditions.push(eq(roles.userType, userType));
    }

    return this.database.db
      .select({
        id: roles.id,
        name: roles.name,
        userType: roles.userType,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(...conditions));
  }

  // --- User type management ---

  async getUserTypes(userId: string): Promise<string[]> {
    const results = await this.database.db
      .select({ userType: userUserTypes.userType })
      .from(userUserTypes)
      .where(eq(userUserTypes.userId, userId));

    return results.map((r) => r.userType);
  }

  async assignUserType(userId: string, userType: string, tx?: DrizzleDB): Promise<void> {
    const db = tx ?? this.database.db;
    await db
      .insert(userUserTypes)
      .values({ userId, userType })
      .onConflictDoNothing();
  }

  async removeUserType(userId: string, userType: string): Promise<void> {
    await this.database.db
      .delete(userUserTypes)
      .where(and(eq(userUserTypes.userId, userId), eq(userUserTypes.userType, userType)));
  }

  // --- Permission registry (delegates to internal service) ---

  registerPermissions(module: string, perms: { action: string; description: string }[]) {
    this.permissionRegistry.register(module, perms);
  }

  getAllRegisteredPermissions() {
    return this.permissionRegistry.getAll();
  }

  // --- Private helpers ---

  private async ensurePermissionsExist(names: string[]): Promise<Permission[]> {
    if (names.length === 0) return [];

    const existing = await this.database.db
      .select()
      .from(permissions)
      .where(inArray(permissions.name, names));

    const existingNames = new Set(existing.map((p) => p.name));
    const missing = names.filter((n) => !existingNames.has(n));

    if (missing.length > 0) {
      const created = await this.database.db
        .insert(permissions)
        .values(missing.map((name) => ({ name })))
        .returning();
      return [...existing, ...created];
    }

    return existing;
  }
}
