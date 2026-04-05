import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DatabaseService, eq, and, ilike, asc, desc, count, inArray, users, type SQL } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { roles } from '../schema/roles';
import { rolePermissions } from '../schema/role-permissions';
import { userRoles } from '../schema/user-roles';
import { PermissionRegistryService } from './permission-registry.service';
import type { Role, RoleWithSystem, ScopedPermissions, PermissionScope } from '../types';

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
      .values(withTenantInsert(roles, {
        name: data.name,
        userType: data.userType,
        isDefault: data.isDefault ?? false,
      }))
      .returning();
    return role;
  }

  async updateRole(id: string, data: { name: string }): Promise<Role> {
    if (await this.isSystemRole(id)) {
      throw new ConflictException('Cannot modify the system admin role');
    }

    const [role] = await this.database.db
      .update(roles)
      .set(data)
      .where(withTenant(roles, eq(roles.id, id)))
      .returning();

    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.findRoleById(id);
    if (!role) throw new NotFoundException('Role not found');

    if (await this.isSystemRole(id)) {
      throw new ConflictException('Cannot delete the system admin role');
    }

    if (role.isDefault) {
      throw new ConflictException('Cannot delete a default role');
    }

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(userRoles)
      .where(withTenant(userRoles, eq(userRoles.roleId, id)));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete a role that is assigned to users. Remove the role from all users first.');
    }

    await this.database.db
      .delete(roles)
      .where(withTenant(roles, eq(roles.id, id)));
  }

  async getRoleUserCount(id: string): Promise<number> {
    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(userRoles)
      .where(withTenant(userRoles, eq(userRoles.roleId, id)));
    return Number(total);
  }

  async findRoleById(id: string): Promise<Role | null> {
    const [role] = await this.database.db
      .select()
      .from(roles)
      .where(withTenant(roles, eq(roles.id, id)))
      .limit(1);

    return role ?? null;
  }

  async findRolesByUserType(userType: string): Promise<Role[]> {
    return this.database.db
      .select()
      .from(roles)
      .where(withTenant(roles, eq(roles.userType, userType)));
  }

  async findDefaultRoleForUserType(userType: string): Promise<Role | null> {
    const [role] = await this.database.db
      .select()
      .from(roles)
      .where(withTenant(roles, eq(roles.userType, userType), eq(roles.isDefault, true)))
      .limit(1);

    return role ?? null;
  }

  async findRoleByIdOrFail(id: string): Promise<Role> {
    const role = await this.findRoleById(id);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async listRoles(query: {
    page?: number;
    limit?: number;
    search?: string;
    userType?: string;
    sort?: 'name' | 'createdAt';
    order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<RoleWithSystem>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.userType) {
      conditions.push(eq(roles.userType, query.userType));
    }

    if (query.search) {
      conditions.push(ilike(roles.name, `%${query.search}%`));
    }

    const whereClause = withTenant(roles, ...conditions);

    const sortColumn = {
      name: roles.name,
      createdAt: roles.createdAt,
    }[query.sort ?? 'createdAt'];

    const orderFn = query.order === 'asc' ? asc : desc;

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(roles)
      .where(whereClause);

    const rawData = await this.database.db
      .select()
      .from(roles)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    const data = await this.withSystemFlag(rawData);

    return {
      data,
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  // --- Permissions ---

  async getPermissionsForUser(userId: string, userType: string): Promise<ScopedPermissions> {
    // Load permissions from role_permissions — wildcard '*' is stored as a regular permission
    const results = await this.database.db
      .select({ permission: rolePermissions.permission, scope: rolePermissions.scope })
      .from(userRoles)
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.userType, userType)))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(withTenant(userRoles, eq(userRoles.userId, userId)));

    const scopedPermissions: ScopedPermissions = {};
    for (const r of results) {
      const existing = scopedPermissions[r.permission];
      const incoming = r.scope as PermissionScope;
      if (!existing || this.scopeRank(incoming) > this.scopeRank(existing)) {
        scopedPermissions[r.permission] = incoming;
      }
    }
    return scopedPermissions;
  }

  async setRolePermissions(
    roleId: string,
    permissionEntries: string[] | { name: string; scope?: PermissionScope }[],
    actorPermissions?: ScopedPermissions,
  ): Promise<void> {
    const role = await this.findRoleById(roleId);
    if (!role) throw new NotFoundException('Role not found');

    const entries = permissionEntries.map((e) =>
      typeof e === 'string' ? { name: e, scope: 'all' as PermissionScope } : { name: e.name, scope: e.scope ?? 'all' },
    );

    // Load current permissions once for enforcement checks
    const currentPermissions = await this.getRolePermissions(roleId);

    // System role protection: roles with '*' cannot have their permissions modified
    if ('*' in currentPermissions && actorPermissions) {
      throw new ConflictException('Cannot modify permissions of the system admin role');
    }

    // Enforce "grant only what you hold" when actor permissions are provided
    if (actorPermissions) {
      const isWildcard = '*' in actorPermissions;

      if (!isWildcard) {
        // Actor must hold every permission being granted
        const unauthorized = entries.filter((e) => !(e.name in actorPermissions));
        if (unauthorized.length > 0) {
          throw new ForbiddenException(
            `You cannot grant permissions you do not hold: ${unauthorized.map((e) => e.name).join(', ')}`,
          );
        }

        // Actor can only remove permissions they hold
        const beingRemoved = Object.keys(currentPermissions).filter(
          (perm) => !entries.some((e) => e.name === perm),
        );
        const unauthorizedRemovals = beingRemoved.filter((perm) => !(perm in actorPermissions));
        if (unauthorizedRemovals.length > 0) {
          throw new ForbiddenException(
            `You cannot remove permissions you do not hold: ${unauthorizedRemovals.join(', ')}`,
          );
        }
      }
    }

    // Lockout prevention: if '*' is being removed from this role, ensure at least one other user still has '*'
    const hadWildcard = '*' in currentPermissions;
    const willHaveWildcard = entries.some((e) => e.name === '*');

    if (hadWildcard && !willHaveWildcard) {
      const remainingWildcardUsers = await this.countWildcardUsers(roleId);
      if (remainingWildcardUsers === 0) {
        throw new ConflictException(
          'Cannot remove wildcard (*) permission — at least one user must retain admin access',
        );
      }
    }

    await this.database.db.transaction(async (tx) => {
      await tx
        .delete(rolePermissions)
        .where(withTenant(rolePermissions, eq(rolePermissions.roleId, roleId)));

      if (entries.length > 0) {
        await tx
          .insert(rolePermissions)
          .values(withTenantInsert(rolePermissions, entries.map((e) => ({
            roleId,
            permission: e.name,
            scope: e.scope,
          }))));
      }
    });
  }

  async getRolePermissions(roleId: string): Promise<ScopedPermissions> {
    const results = await this.database.db
      .select({ permission: rolePermissions.permission, scope: rolePermissions.scope })
      .from(rolePermissions)
      .where(withTenant(rolePermissions, eq(rolePermissions.roleId, roleId)));

    const scopedPermissions: ScopedPermissions = {};
    for (const r of results) {
      scopedPermissions[r.permission] = r.scope as PermissionScope;
    }
    return scopedPermissions;
  }

  // --- User-role assignment ---

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    const role = await this.findRoleById(roleId);
    if (!role) throw new NotFoundException('Role not found');

    const [user] = await this.database.db
      .select({ userType: users.userType })
      .from(users)
      .where(withTenant(users, eq(users.id, userId)))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    if (user.userType !== role.userType) {
      throw new ConflictException(
        `Cannot assign role scoped to '${role.userType}' — user type is '${user.userType}'`,
      );
    }

    await this.database.db
      .insert(userRoles)
      .values(withTenantInsert(userRoles, { userId, roleId }))
      .onConflictDoNothing();
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await this.database.db
      .delete(userRoles)
      .where(withTenant(userRoles, eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
  }

  async getUserRoles(userId: string, userType?: string): Promise<Role[]> {
    const conditions: (SQL | undefined)[] = [eq(userRoles.userId, userId)];
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
      .where(withTenant(userRoles, ...conditions));
  }

  // --- Permission registry (delegates to internal service) ---

  registerPermissions(module: string, perms: { action: string; description: string }[]) {
    this.permissionRegistry.register(module, perms);
  }

  getAllRegisteredPermissions() {
    return this.permissionRegistry.getAll();
  }

  // --- Private helpers ---

  /**
   * Check if a role is a system role (has wildcard '*' permission).
   * System roles cannot be edited, deleted, or have their permissions modified.
   */
  async isSystemRole(roleId: string): Promise<boolean> {
    const perms = await this.getRolePermissions(roleId);
    return '*' in perms;
  }

  /**
   * Get the set of role IDs that have the wildcard '*' permission.
   */
  private async getSystemRoleIds(): Promise<Set<string>> {
    const rows = await this.database.db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .where(withTenant(rolePermissions, eq(rolePermissions.permission, '*')));
    return new Set(rows.map((r) => r.roleId));
  }

  /**
   * Enrich roles with computed isSystem flag.
   */
  private async withSystemFlag(roleList: Role[]): Promise<RoleWithSystem[]> {
    if (roleList.length === 0) return [];
    const systemIds = await this.getSystemRoleIds();
    return roleList.map((role) => ({ ...role, isSystem: systemIds.has(role.id) }));
  }

  /**
   * Count users who have the wildcard '*' permission through any of their roles.
   * Optionally exclude a specific role from the count (to check "what if this role lost *?").
   */
  async countWildcardUsers(excludeRoleId?: string): Promise<number> {
    const wildcardRoleRows = await this.database.db
      .select({ roleId: rolePermissions.roleId })
      .from(rolePermissions)
      .where(withTenant(rolePermissions, eq(rolePermissions.permission, '*')));

    let wildcardRoleIds = wildcardRoleRows.map((r) => r.roleId);

    if (excludeRoleId) {
      wildcardRoleIds = wildcardRoleIds.filter((id) => id !== excludeRoleId);
    }

    if (wildcardRoleIds.length === 0) return 0;

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(userRoles)
      .where(withTenant(userRoles, inArray(userRoles.roleId, wildcardRoleIds)));

    return Number(total);
  }

  private scopeRank(scope: PermissionScope): number {
    const ranks: Record<PermissionScope, number> = { own: 1, all: 2 };
    return ranks[scope] ?? 0;
  }
}
