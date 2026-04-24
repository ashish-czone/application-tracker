import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DatabaseService, eq, and, or, isNull, ilike, asc, desc, count, inArray, users, type SQL } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import {
  createSoftDeleteExecutor,
  defineSoftDeletePolicy,
  notDeleted,
  type SoftDeleteExecutor,
} from '@packages/soft-delete';
import { roles } from '../schema/roles';
import { rolePermissions } from '../schema/role-permissions';
import { rolePermissionScopes } from '../schema/role-permission-scopes';
import { userRoles } from '../schema/user-roles';
import { PermissionManifestRegistry, type PermissionManifest } from '../permission-manifest';
import { normaliseScopes } from '../scope-types';
import type { Role, RoleMember, RoleWithSystem, ScopedPermissions, BooleanPermissions, ScopeSpec } from '../types';

@Injectable()
export class RbacService {
  private readonly deleteExecutor: SoftDeleteExecutor = createSoftDeleteExecutor(
    defineSoftDeletePolicy({
      table: roles,
      mode: 'soft',
      dependents: [
        { table: userRoles, foreignKey: 'roleId', strategy: 'hardDelete' },
        { table: rolePermissions, foreignKey: 'roleId', strategy: 'keep' },
      ],
    }),
  );

  constructor(
    private readonly database: DatabaseService,
    private readonly manifestRegistry: PermissionManifestRegistry,
  ) {}

  // --- Roles ---

  async createRole(data: { name: string; userType?: string | null; isDefault?: boolean }): Promise<Role> {
    const [role] = await this.database.db
      .insert(roles)
      .values(withTenantInsert(roles, {
        name: data.name,
        userType: data.userType ?? null,
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

  async deleteRole(id: string, actorId: string): Promise<void> {
    const role = await this.findRoleById(id);
    if (!role) throw new NotFoundException('Role not found');

    if (await this.isSystemRole(id)) {
      throw new ConflictException('Cannot delete the system admin role');
    }

    if (role.isDefault) {
      throw new ConflictException('Cannot delete a default role');
    }

    await this.deleteExecutor.delete(this.database.db, id, actorId);
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
      .where(withTenant(roles, eq(roles.id, id), notDeleted(roles)))
      .limit(1);

    return role ?? null;
  }

  async findRolesByUserType(userType: string): Promise<Role[]> {
    return this.database.db
      .select()
      .from(roles)
      .where(withTenant(roles, eq(roles.userType, userType), notDeleted(roles)));
  }

  async findDefaultRoleForUserType(userType: string): Promise<Role | null> {
    const [role] = await this.database.db
      .select()
      .from(roles)
      .where(withTenant(roles, eq(roles.userType, userType), eq(roles.isDefault, true), notDeleted(roles)))
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

    const conditions: SQL[] = [notDeleted(roles)];

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
    // Load grants + their scopes in a single LEFT JOIN. Null scopeType rows
    // mean the grant has no scopes persisted — treated as `any` (unrestricted)
    // so pre-scope-migration grants behave as before.
    const results = await this.database.db
      .select({
        permission: rolePermissions.permission,
        scopeType: rolePermissionScopes.scopeType,
        scopeParams: rolePermissionScopes.scopeParams,
      })
      .from(userRoles)
      .innerJoin(roles, and(
        eq(roles.id, userRoles.roleId),
        or(eq(roles.userType, userType), isNull(roles.userType)),
        notDeleted(roles),
      ))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .leftJoin(rolePermissionScopes, and(
        eq(rolePermissionScopes.roleId, rolePermissions.roleId),
        eq(rolePermissionScopes.permission, rolePermissions.permission),
      ))
      .where(withTenant(userRoles, eq(userRoles.userId, userId)));

    const accumulated: Record<string, ScopeSpec[]> = {};
    for (const r of results) {
      const scope: ScopeSpec = r.scopeType
        ? { type: r.scopeType, ...(r.scopeParams ? { params: r.scopeParams as Record<string, unknown> } : {}) }
        : { type: 'any' };
      (accumulated[r.permission] ??= []).push(scope);
    }

    const permissions: ScopedPermissions = {};
    for (const [perm, scopes] of Object.entries(accumulated)) {
      permissions[perm] = normaliseScopes(scopes);
    }
    return permissions;
  }

  async setRolePermissions(
    roleId: string,
    permissionEntries: string[] | { name: string; scopes?: ScopeSpec[] }[],
    actorPermissions?: BooleanPermissions | ScopedPermissions,
  ): Promise<void> {
    const role = await this.findRoleById(roleId);
    if (!role) throw new NotFoundException('Role not found');

    const entries = permissionEntries.map((e) =>
      typeof e === 'string'
        ? { name: e, scopes: [{ type: 'any' }] as ScopeSpec[] }
        : { name: e.name, scopes: normaliseScopes(e.scopes && e.scopes.length > 0 ? e.scopes : [{ type: 'any' }]) },
    );

    this.validateGrantScopes(entries);

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
      // Cascade from role_permissions clears scopes too.
      await tx
        .delete(rolePermissions)
        .where(withTenant(rolePermissions, eq(rolePermissions.roleId, roleId)));

      if (entries.length === 0) return;

      await tx
        .insert(rolePermissions)
        .values(withTenantInsert(rolePermissions, entries.map((e) => ({
          roleId,
          permission: e.name,
        }))));

      const scopeRows = entries.flatMap((e) =>
        e.scopes.map((s) => ({
          roleId,
          permission: e.name,
          scopeType: s.type,
          scopeParams: s.params ?? null,
        })),
      );

      if (scopeRows.length > 0) {
        await tx.insert(rolePermissionScopes).values(scopeRows);
      }
    });
  }

  async getRolePermissions(roleId: string): Promise<ScopedPermissions> {
    const results = await this.database.db
      .select({
        permission: rolePermissions.permission,
        scopeType: rolePermissionScopes.scopeType,
        scopeParams: rolePermissionScopes.scopeParams,
      })
      .from(rolePermissions)
      .leftJoin(rolePermissionScopes, and(
        eq(rolePermissionScopes.roleId, rolePermissions.roleId),
        eq(rolePermissionScopes.permission, rolePermissions.permission),
      ))
      .where(withTenant(rolePermissions, eq(rolePermissions.roleId, roleId)));

    const accumulated: Record<string, ScopeSpec[]> = {};
    for (const r of results) {
      if (!(r.permission in accumulated)) accumulated[r.permission] = [];
      if (r.scopeType) {
        accumulated[r.permission].push({
          type: r.scopeType,
          ...(r.scopeParams ? { params: r.scopeParams as Record<string, unknown> } : {}),
        });
      }
    }

    const permissions: ScopedPermissions = {};
    for (const [perm, scopes] of Object.entries(accumulated)) {
      permissions[perm] = scopes.length > 0 ? normaliseScopes(scopes) : [{ type: 'any' }];
    }
    return permissions;
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

    if (role.userType !== null && user.userType !== role.userType) {
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

  // --- Role members (users assigned to a role) ---

  async listRoleMembers(roleId: string, query: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedResponse<RoleMember>> {
    await this.findRoleByIdOrFail(roleId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(userRoles.roleId, roleId)];
    if (query.search) {
      const term = `%${query.search}%`;
      const searchClause = or(
        ilike(users.firstName, term),
        ilike(users.lastName, term),
        ilike(users.email, term),
      );
      if (searchClause) conditions.push(searchClause);
    }

    const whereClause = withTenant(userRoles, ...conditions);

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(whereClause);

    const rows = await this.database.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        addedAt: userRoles.createdAt,
      })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(whereClause)
      .orderBy(desc(userRoles.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async addRoleMember(roleId: string, userId: string): Promise<RoleMember> {
    await this.assignRoleToUser(userId, roleId);

    const [row] = await this.database.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        addedAt: userRoles.createdAt,
      })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(withTenant(userRoles, eq(userRoles.roleId, roleId), eq(userRoles.userId, userId)))
      .limit(1);

    if (!row) throw new NotFoundException('Member not found after assignment');
    return row;
  }

  async removeRoleMember(roleId: string, userId: string): Promise<void> {
    await this.findRoleByIdOrFail(roleId);
    await this.removeRoleFromUser(userId, roleId);
  }

  async getUserRoles(userId: string, userType?: string): Promise<Role[]> {
    const conditions: (SQL | undefined)[] = [eq(userRoles.userId, userId), notDeleted(roles)];
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

  /**
   * Batch-load roles for a list of user IDs in a single query. Returns a
   * map keyed by userId; users with no roles get an empty array entry so
   * callers can index without a null check. Intended for list-page
   * enrichment (avoids N+1 in entity-engine afterList hooks).
   */
  async getRolesByUserIds(userIds: string[]): Promise<Record<string, Role[]>> {
    const result: Record<string, Role[]> = {};
    for (const id of userIds) result[id] = [];

    if (userIds.length === 0) return result;

    const rows = await this.database.db
      .select({
        userId: userRoles.userId,
        id: roles.id,
        name: roles.name,
        userType: roles.userType,
        isDefault: roles.isDefault,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(withTenant(userRoles, inArray(userRoles.userId, userIds), notDeleted(roles)));

    for (const row of rows) {
      const { userId, ...role } = row;
      (result[userId] ??= []).push(role);
    }

    return result;
  }

  // --- Permission registry ---

  /**
   * Register permission manifests. Every module that introduces permissions
   * calls this in `onModuleInit` (or has entity-engine do it via
   * `defineEntity`). The manifest carries the scope types the permission
   * supports, which the role-grant path uses to reject invalid scope types
   * and the role editor UI uses to decide which scope pickers to offer.
   */
  registerManifests(manifests: PermissionManifest[]): void {
    this.manifestRegistry.registerMany(manifests);
  }

  /**
   * Reject grants whose scope types are not declared in the permission's
   * manifest. Wildcard `*` is system-admin and has no manifest — always
   * allowed. Slugs with no registered manifest are currently permissive
   * (manifests are being rolled out module-by-module); once every call site
   * has migrated this branch tightens to reject unknown slugs.
   */
  private validateGrantScopes(entries: { name: string; scopes: ScopeSpec[] }[]): void {
    const violations: string[] = [];
    for (const entry of entries) {
      if (entry.name === '*') continue;
      const supported = this.manifestRegistry.getSupportedScopes(entry.name);
      if (!supported) continue;
      for (const scope of entry.scopes) {
        if (!supported.includes(scope.type)) {
          violations.push(`${entry.name}: scope '${scope.type}' not in supportedScopes [${supported.join(', ')}]`);
        }
      }
    }
    if (violations.length > 0) {
      throw new ConflictException(
        `Unsupported scope types in grant:\n${violations.join('\n')}`,
      );
    }
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

}
