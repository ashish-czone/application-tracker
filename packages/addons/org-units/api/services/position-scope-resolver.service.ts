import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, inArray, sql } from '@packages/database';
import { orgUnitMembers } from '../schema/org-unit-members';

/**
 * Org-tree traversal utility used by hierarchical scope resolvers (`unit`,
 * `descendants`). Given an actor and a scope level, it expands to the set of
 * user IDs and org-unit IDs the actor "covers" through the position tree.
 *
 * Scope authorisation rules live on role-permission grants; this service
 * supplies the raw tree expansion the scope resolver needs to translate
 * `unit` / `descendants` into concrete WHERE IN lists.
 */
@Injectable()
export class PositionScopeResolverService {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Resolves the set of user IDs covered by a hierarchical scope rooted at
   * the actor. Returns `null` for non-hierarchical scope keys so the caller
   * can fall through to per-scope-type handling.
   */
  async resolveUserIds(userId: string, scope: string): Promise<string[] | null> {
    if (scope === 'descendants') {
      return this.getDescendantUserIds(userId);
    }

    if (scope === 'unit') {
      return this.getUnitUserIds(userId);
    }

    return null;
  }

  /**
   * Resolves the set of org-unit IDs covered by a hierarchical scope. Returns
   * `null` for non-hierarchical scope keys.
   */
  async resolveOrgUnitIds(userId: string, scope: string): Promise<string[] | null> {
    if (scope === 'descendants') {
      return this.getDescendantOrgUnitIds(userId);
    }

    if (scope === 'unit') {
      return this.getDirectOrgUnitIds(userId);
    }

    return null;
  }

  /**
   * Returns all user IDs in the user's org units + all descendant org units.
   * Always includes the user themselves.
   */
  private async getDescendantUserIds(userId: string): Promise<string[]> {
    const result = await this.database.db.execute<{ user_id: string }>(sql`
      WITH RECURSIVE user_units AS (
        -- Org units the user is directly a member of
        SELECT ou.id
        FROM org_unit_members oum
        INNER JOIN org_units ou ON ou.id = oum.org_unit_id
        WHERE oum.user_id = ${userId}
      ),
      descendants AS (
        SELECT id FROM user_units
        UNION ALL
        SELECT child.id
        FROM org_units child
        INNER JOIN descendants d ON child.parent_id = d.id
      ),
      visible_users AS (
        SELECT DISTINCT oum.user_id
        FROM org_unit_members oum
        WHERE oum.org_unit_id IN (SELECT id FROM descendants)
      )
      SELECT user_id FROM visible_users
    `);

    const userIds = new Set(result.rows.map((r) => r.user_id));
    userIds.add(userId);
    return Array.from(userIds);
  }

  /**
   * Returns all user IDs in the user's direct org units (no descendants).
   * Always includes the user themselves.
   */
  private async getUnitUserIds(userId: string): Promise<string[]> {
    // Get the user's org unit IDs
    const userUnits = await this.database.db
      .select({ orgUnitId: orgUnitMembers.orgUnitId })
      .from(orgUnitMembers)
      .where(eq(orgUnitMembers.userId, userId));

    if (userUnits.length === 0) return [userId];

    const orgUnitIds = userUnits.map((r) => r.orgUnitId);

    // Get all members in those org units
    const members = await this.database.db
      .select({ userId: orgUnitMembers.userId })
      .from(orgUnitMembers)
      .where(inArray(orgUnitMembers.orgUnitId, orgUnitIds));

    const userIds = new Set(members.map((r) => r.userId));
    userIds.add(userId);
    return Array.from(userIds);
  }

  /**
   * Returns org unit IDs the user is directly a member of + all descendant units.
   */
  private async getDescendantOrgUnitIds(userId: string): Promise<string[]> {
    const result = await this.database.db.execute<{ id: string }>(sql`
      WITH RECURSIVE user_units AS (
        SELECT ou.id
        FROM org_unit_members oum
        INNER JOIN org_units ou ON ou.id = oum.org_unit_id
        WHERE oum.user_id = ${userId}
      ),
      descendants AS (
        SELECT id FROM user_units
        UNION ALL
        SELECT child.id
        FROM org_units child
        INNER JOIN descendants d ON child.parent_id = d.id
      )
      SELECT DISTINCT id FROM descendants
    `);
    return result.rows.map((r) => r.id);
  }

  /**
   * Returns org unit IDs the user is directly a member of (no descendants).
   */
  private async getDirectOrgUnitIds(userId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ orgUnitId: orgUnitMembers.orgUnitId })
      .from(orgUnitMembers)
      .where(eq(orgUnitMembers.userId, userId));
    return rows.map((r) => r.orgUnitId);
  }
}
