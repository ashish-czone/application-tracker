import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { eq, inArray } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import type { RelationHandler, RelationHandlerContext } from '@packages/entity-engine-contract';
import { userRoles } from '../schema/user-roles';
import { RbacService } from '../services/rbac.service';

/**
 * Owns the write side of the `roles` manyToMany relationship on the users
 * entity. Reads the user's `userType` from `ctx.parent.userType` to validate
 * each role assignment without an extra SELECT on the users table (which
 * would not see the uncommitted parent row in an onCreate tx anyway).
 *
 * Payload shape: `string[]` — array of role IDs.
 *
 * Invoked by `@packages/entity-engine` inside the parent's create/update tx.
 */
@Injectable()
export class UserRolesRelationHandler implements RelationHandler {
  constructor(private readonly rbacService: RbacService) {}

  async onCreate(
    tx: unknown,
    userId: string,
    payload: unknown,
    _actorId: string,
    ctx: RelationHandlerContext,
  ): Promise<void> {
    const roleIds = this.parsePayload(payload);
    if (roleIds.length === 0) return;

    const userType = this.resolveUserType(ctx);
    await this.validateRoles(roleIds, userType);
    await this.insertAssignments(tx, userId, roleIds);
  }

  async onUpdate(
    tx: unknown,
    userId: string,
    payload: unknown,
    _actorId: string,
    ctx: RelationHandlerContext,
  ): Promise<void> {
    const desired = new Set(this.parsePayload(payload));
    const userType = this.resolveUserType(ctx);

    const current = await this.readCurrentRoleIds(tx, userId);
    const toAdd = [...desired].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !desired.has(id));

    if (toAdd.length > 0) {
      await this.validateRoles(toAdd, userType);
      await this.insertAssignments(tx, userId, toAdd);
    }
    if (toRemove.length > 0) {
      await this.removeAssignments(tx, userId, toRemove);
    }
  }

  /**
   * No-op: user_roles has an FK to users.id that cascades on hard delete.
   * On soft delete we leave assignments in place so a restore brings roles
   * back automatically.
   */
  async onDelete(
    _tx: unknown,
    _parentId: string,
    _actorId: string,
    _opts: { kind: 'soft' | 'hard' },
    _ctx: RelationHandlerContext,
  ): Promise<void> {
    // intentionally empty
  }

  private parsePayload(payload: unknown): string[] {
    if (!Array.isArray(payload)) return [];
    const ids: string[] = [];
    for (const value of payload) {
      if (typeof value !== 'string' || value.length === 0) {
        throw new BadRequestException('roles payload must be an array of role ID strings');
      }
      ids.push(value);
    }
    // De-dup while preserving order
    return Array.from(new Set(ids));
  }

  private resolveUserType(ctx: RelationHandlerContext): string | null {
    const userType = ctx.parent?.userType;
    if (userType === undefined || userType === null) return null;
    if (typeof userType !== 'string') {
      throw new BadRequestException('roles handler requires parent.userType to be a string');
    }
    return userType;
  }

  private async validateRoles(roleIds: string[], userType: string | null): Promise<void> {
    for (const roleId of roleIds) {
      const role = await this.rbacService.findRoleById(roleId);
      if (!role) {
        throw new NotFoundException(`Role ${roleId} not found`);
      }
      if (role.userType !== null && role.userType !== userType) {
        throw new ConflictException(
          `Cannot assign role scoped to '${role.userType}' — user type is '${userType ?? 'null'}'`,
        );
      }
    }
  }

  private async insertAssignments(tx: unknown, userId: string, roleIds: string[]): Promise<void> {
    const db = tx as { insert: (table: unknown) => any };
    for (const roleId of roleIds) {
      await db
        .insert(userRoles)
        .values(withTenantInsert(userRoles, { userId, roleId }))
        .onConflictDoNothing();
    }
  }

  private async removeAssignments(tx: unknown, userId: string, roleIds: string[]): Promise<void> {
    const db = tx as { delete: (table: unknown) => any };
    await db
      .delete(userRoles)
      .where(withTenant(userRoles, eq(userRoles.userId, userId), inArray(userRoles.roleId, roleIds)));
  }

  private async readCurrentRoleIds(tx: unknown, userId: string): Promise<Set<string>> {
    const db = tx as { select: (shape: unknown) => any };
    const rows = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(withTenant(userRoles, eq(userRoles.userId, userId)));
    return new Set((rows as { roleId: string }[]).map((r) => r.roleId));
  }
}

