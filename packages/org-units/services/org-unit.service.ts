import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, and, inArray, sql, count } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { orgUnits } from '../schema/org-units';
import { orgUnitMembers } from '../schema/org-unit-members';
import type { OrgUnit, OrgUnitWithMembers } from '../types';

@Injectable()
export class OrgUnitService {
  constructor(private readonly database: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(data: { name: string; parentId?: string; type?: string; sortOrder?: number }): Promise<OrgUnit> {
    const [row] = await this.database.db
      .insert(orgUnits)
      .values(withTenantInsert(orgUnits, {
        name: data.name,
        parentId: data.parentId ?? null,
        type: data.type ?? 'team',
        sortOrder: data.sortOrder ?? 0,
      }))
      .returning() as OrgUnit[];
    return row;
  }

  async findAll(): Promise<OrgUnitWithMembers[]> {
    const rows = await this.database.db
      .select({
        id: orgUnits.id,
        name: orgUnits.name,
        parentId: orgUnits.parentId,
        type: orgUnits.type,
        sortOrder: orgUnits.sortOrder,
        createdAt: orgUnits.createdAt,
        updatedAt: orgUnits.updatedAt,
        memberCount: count(orgUnitMembers.userId),
      })
      .from(orgUnits)
      .leftJoin(orgUnitMembers, eq(orgUnitMembers.orgUnitId, orgUnits.id))
      .where(withTenant(orgUnits))
      .groupBy(orgUnits.id)
      .orderBy(orgUnits.sortOrder);
    return rows as OrgUnitWithMembers[];
  }

  async findOneOrFail(id: string): Promise<OrgUnit> {
    const [row] = await this.database.db
      .select()
      .from(orgUnits)
      .where(withTenant(orgUnits, eq(orgUnits.id, id)))
      .limit(1) as OrgUnit[];
    if (!row) throw new NotFoundException('Org unit not found');
    return row;
  }

  async update(id: string, data: Partial<{ name: string; parentId: string | null; type: string; sortOrder: number }>): Promise<OrgUnit> {
    await this.findOneOrFail(id);
    const [row] = await this.database.db
      .update(orgUnits)
      .set(data)
      .where(withTenant(orgUnits, eq(orgUnits.id, id)))
      .returning() as OrgUnit[];
    return row;
  }

  async delete(id: string): Promise<void> {
    await this.findOneOrFail(id);
    await this.database.db.delete(orgUnitMembers).where(eq(orgUnitMembers.orgUnitId, id));
    await this.database.db.delete(orgUnits).where(withTenant(orgUnits, eq(orgUnits.id, id)));
  }

  // ---------------------------------------------------------------------------
  // Member management
  // ---------------------------------------------------------------------------

  async addMember(orgUnitId: string, userId: string): Promise<void> {
    await this.findOneOrFail(orgUnitId);
    await this.database.db
      .insert(orgUnitMembers)
      .values({ orgUnitId, userId })
      .onConflictDoNothing();
  }

  async removeMember(orgUnitId: string, userId: string): Promise<void> {
    await this.database.db
      .delete(orgUnitMembers)
      .where(and(eq(orgUnitMembers.orgUnitId, orgUnitId), eq(orgUnitMembers.userId, userId)));
  }

  async getMemberIds(orgUnitId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({ userId: orgUnitMembers.userId })
      .from(orgUnitMembers)
      .where(eq(orgUnitMembers.orgUnitId, orgUnitId));
    return rows.map((r) => r.userId);
  }

  // ---------------------------------------------------------------------------
  // Hierarchy + visibility resolution
  // ---------------------------------------------------------------------------

  /**
   * Returns all org unit IDs the user is a member of, plus all descendant org units.
   * If a user is in "Sales Division", they also get visibility into "Sales Team 1", "Sales Team 2", etc.
   */
  async getVisibleOrgUnitIds(userId: string): Promise<string[]> {
    const result = await this.database.db.execute<{ id: string }>(sql`
      WITH RECURSIVE descendants AS (
        SELECT ou.id, 1 AS depth
        FROM org_unit_members oum
        INNER JOIN org_units ou ON ou.id = oum.org_unit_id
        WHERE oum.user_id = ${userId}
        UNION ALL
        SELECT child.id, d.depth + 1
        FROM org_units child
        INNER JOIN descendants d ON child.parent_id = d.id
        WHERE d.depth < 20
      )
      SELECT DISTINCT id FROM descendants
    `);
    return result.rows.map((r) => r.id);
  }

  /**
   * Returns all user IDs that share at least one org unit with the given user.
   * Includes the user themselves.
   */
  async getTeamMemberIds(userId: string): Promise<string[]> {
    const orgUnitIds = await this.getVisibleOrgUnitIds(userId);
    if (orgUnitIds.length === 0) return [userId];

    const rows = await this.database.db
      .select({ userId: orgUnitMembers.userId })
      .from(orgUnitMembers)
      .where(inArray(orgUnitMembers.orgUnitId, orgUnitIds));

    const userIds = new Set(rows.map((r) => r.userId));
    userIds.add(userId);
    return Array.from(userIds);
  }
}
