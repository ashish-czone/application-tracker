import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, and, inArray, sql } from '@packages/database';
import { orgUnitMembers } from '../schema/org-unit-members';
import { orgPositionScopes } from '../schema/org-position-scopes';
import { POSITION_SCOPE_RANK } from '../types';
import type { PositionScopeProvider } from '../types';

/**
 * Core scope resolution engine.
 *
 * Resolves a user's data access scope for a given entity type based on their
 * org position(s). When a user holds multiple positions across different org units,
 * the most permissive scope wins.
 *
 * Built-in scope levels (most → least permissive):
 * - 'all'         — no filter, see everything
 * - 'descendants' — see own org unit(s) + all descendant org units
 * - 'unit'        — see only own org unit(s)
 * - 'own'         — see only own records
 *
 * Custom scope keys (e.g. 'hiring-manager') are treated as equivalent to 'own'
 * for ranking purposes — they're entity-specific and resolved by the entity's
 * custom scope resolver.
 */
@Injectable()
export class PositionScopeResolverService implements PositionScopeProvider {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Returns the most permissive scope string for a user on a given entity type.
   * Defaults to 'own' when no position/scope mapping exists (fail-closed).
   */
  async resolveScope(userId: string, entityType: string): Promise<string> {
    // Join org_unit_members → org_position_scopes to get all scopes for this user + entity
    const rows = await this.database.db
      .select({ scope: orgPositionScopes.scope })
      .from(orgUnitMembers)
      .innerJoin(
        orgPositionScopes,
        and(
          eq(orgPositionScopes.positionId, orgUnitMembers.positionId),
          eq(orgPositionScopes.entityType, entityType),
        ),
      )
      .where(eq(orgUnitMembers.userId, userId));

    if (rows.length === 0) return 'own';

    // Most permissive wins
    let bestScope = rows[0].scope;
    let bestRank = this.scopeRank(bestScope);

    for (let i = 1; i < rows.length; i++) {
      const rank = this.scopeRank(rows[i].scope);
      if (rank > bestRank) {
        bestRank = rank;
        bestScope = rows[i].scope;
      }
    }

    return bestScope;
  }

  /**
   * Resolves the set of user IDs visible for the given scope.
   * Returns null for 'all' (no filter needed).
   * Returns [userId] for 'own' or unrecognized scopes.
   * For 'descendants' and 'unit', expands org unit hierarchy accordingly.
   */
  async resolveUserIds(userId: string, scope: string): Promise<string[] | null> {
    if (scope === 'all') return null;
    if (scope === 'own') return [userId];

    if (scope === 'descendants') {
      return this.getDescendantUserIds(userId);
    }

    if (scope === 'unit') {
      return this.getUnitUserIds(userId);
    }

    // Custom scope keys (e.g. 'hiring-manager') — entity engine handles these
    // via its custom scope resolvers, so we just return null to signal delegation
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

  private scopeRank(scope: string): number {
    return POSITION_SCOPE_RANK[scope] ?? 1;
  }
}
