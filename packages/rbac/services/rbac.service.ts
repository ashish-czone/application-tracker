import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, and, inArray, users } from '@packages/database';
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

  async createRole(data: { name: string; userType: string; isDefault?: boolean }): Promise<Role> {
    const [role] = await this.database.db
      .insert(roles)
      .values({
        name: data.name,
        userType: data.userType,
        isDefault: data.isDefault ?? false,
      })
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
    const role = await this.findRoleById(id);
    if (!role) throw new NotFoundException('Role not found');

    if (role.isDefault) {
      throw new ConflictException('Cannot delete a default role');
    }

    await this.database.db
      .delete(roles)
      .where(eq(roles.id, id));
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

  async findDefaultRoleForUserType(userType: string): Promise<Role | null> {
    const [role] = await this.database.db
      .select()
      .from(roles)
      .where(and(eq(roles.userType, userType), eq(roles.isDefault, true)))
      .limit(1);

    return role ?? null;
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

    // Validate user's type matches the role's type
    const [user] = await this.database.db
      .select({ userType: users.userType })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    if (user.userType !== role.userType) {
      throw new ConflictException(
        `Cannot assign role scoped to '${role.userType}' — user type is '${user.userType}'`,
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
        isDefault: roles.isDefault,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(...conditions));
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
