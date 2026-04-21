import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, and, inArray, sql, count } from '@packages/database';
import { users } from '@packages/database/schema';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { orgUnits } from '../schema/org-units';
import { orgUnitMembers } from '../schema/org-unit-members';
import { orgUnitLevels } from '../schema/org-unit-levels';
import { orgPositions } from '../schema/org-positions';
import type { OrgUnit, OrgUnitWithDetails, OrgUnitMemberDetail } from '../types';

@Injectable()
export class OrgUnitService {
  constructor(private readonly database: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(data: { name: string; description?: string | null; parentId?: string; levelId: string; sortOrder?: number }): Promise<OrgUnit> {
    const [row] = await this.database.db
      .insert(orgUnits)
      .values(withTenantInsert(orgUnits, {
        name: data.name,
        description: data.description ?? null,
        parentId: data.parentId ?? null,
        levelId: data.levelId,
        sortOrder: data.sortOrder ?? 0,
      }))
      .returning() as OrgUnit[];
    return row;
  }

  async findAll(): Promise<OrgUnitWithDetails[]> {
    // Fetch all units with level info and member count
    const rows = await this.database.db
      .select({
        id: orgUnits.id,
        name: orgUnits.name,
        description: orgUnits.description,
        parentId: orgUnits.parentId,
        levelId: orgUnits.levelId,
        sortOrder: orgUnits.sortOrder,
        createdAt: orgUnits.createdAt,
        updatedAt: orgUnits.updatedAt,
        memberCount: count(orgUnitMembers.userId),
        levelName: orgUnitLevels.name,
        levelSortOrder: orgUnitLevels.sortOrder,
      })
      .from(orgUnits)
      .leftJoin(orgUnitMembers, eq(orgUnitMembers.orgUnitId, orgUnits.id))
      .innerJoin(orgUnitLevels, eq(orgUnitLevels.id, orgUnits.levelId))
      .where(withTenant(orgUnits))
      .groupBy(orgUnits.id, orgUnitLevels.name, orgUnitLevels.sortOrder)
      .orderBy(orgUnits.sortOrder);

    if (rows.length === 0) return [];

    // Fetch top 3 members per unit (ordered by position sortOrder)
    const unitIds = rows.map((r) => r.id);
    const memberRows = await this.database.db.execute<{
      org_unit_id: string;
      user_id: string;
      user_name: string;
      position_name: string | null;
      rn: number;
    }>(sql`
      SELECT org_unit_id, user_id, user_name, position_name, rn
      FROM (
        SELECT
          oum.org_unit_id,
          oum.user_id,
          concat(u.first_name, ' ', u.last_name) AS user_name,
          op.name AS position_name,
          row_number() OVER (
            PARTITION BY oum.org_unit_id
            ORDER BY coalesce(op.sort_order, 999999)
          ) AS rn
        FROM org_unit_members oum
        INNER JOIN users u ON u.id = oum.user_id
        LEFT JOIN org_positions op ON op.id = oum.position_id
        WHERE oum.org_unit_id IN (${sql.join(unitIds.map((id) => sql`${id}`), sql`, `)})
      ) ranked
      WHERE rn <= 3
      ORDER BY org_unit_id, rn
    `);

    // Group members by unit
    const membersByUnit = new Map<string, OrgUnitMemberDetail[]>();
    for (const row of memberRows.rows) {
      const list = membersByUnit.get(row.org_unit_id) ?? [];
      list.push({
        userId: row.user_id,
        userName: row.user_name,
        positionId: null,
        positionName: row.position_name,
      });
      membersByUnit.set(row.org_unit_id, list);
    }

    return rows.map((row) => {
      const members = membersByUnit.get(row.id) ?? [];
      const head = members[0] ?? null;
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        parentId: row.parentId,
        levelId: row.levelId,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        memberCount: Number(row.memberCount),
        level: { id: row.levelId, name: row.levelName, sortOrder: row.levelSortOrder },
        head: head ? { userId: head.userId, userName: head.userName, positionName: head.positionName ?? '' } : null,
        memberPreviews: members,
      };
    });
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

  async update(id: string, data: Partial<{ name: string; description: string | null; parentId: string | null; levelId: string; sortOrder: number }>): Promise<OrgUnit> {
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

  async addMember(orgUnitId: string, userId: string, positionId?: string): Promise<void> {
    await this.findOneOrFail(orgUnitId);
    await this.database.db
      .insert(orgUnitMembers)
      .values({ orgUnitId, userId, positionId: positionId ?? null })
      .onConflictDoNothing();
  }

  async updateMemberPosition(orgUnitId: string, userId: string, positionId: string | null): Promise<void> {
    await this.database.db
      .update(orgUnitMembers)
      .set({ positionId })
      .where(and(eq(orgUnitMembers.orgUnitId, orgUnitId), eq(orgUnitMembers.userId, userId)));
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

  async getMemberDetails(orgUnitId: string): Promise<OrgUnitMemberDetail[]> {
    const rows = await this.database.db
      .select({
        userId: orgUnitMembers.userId,
        userName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
        positionId: orgUnitMembers.positionId,
        positionName: orgPositions.name,
      })
      .from(orgUnitMembers)
      .innerJoin(users, eq(users.id, orgUnitMembers.userId))
      .leftJoin(orgPositions, eq(orgPositions.id, orgUnitMembers.positionId))
      .where(eq(orgUnitMembers.orgUnitId, orgUnitId))
      .orderBy(sql`coalesce(${orgPositions.sortOrder}, 999999)`);

    return rows.map((r) => ({
      userId: r.userId,
      userName: r.userName,
      positionId: r.positionId,
      positionName: r.positionName,
    }));
  }

  // ---------------------------------------------------------------------------
  // Hierarchy + visibility resolution
  // ---------------------------------------------------------------------------

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

  async getPositionsByUserIds(
    userIds: string[],
  ): Promise<Record<string, Array<{ unitId: string; unitName: string; positionId: string | null; positionName: string | null }>>> {
    if (userIds.length === 0) return {};

    const rows = await this.database.db
      .select({
        userId: orgUnitMembers.userId,
        unitId: orgUnits.id,
        unitName: orgUnits.name,
        positionId: orgUnitMembers.positionId,
        positionName: orgPositions.name,
        positionSortOrder: orgPositions.sortOrder,
      })
      .from(orgUnitMembers)
      .innerJoin(orgUnits, eq(orgUnits.id, orgUnitMembers.orgUnitId))
      .leftJoin(orgPositions, eq(orgPositions.id, orgUnitMembers.positionId))
      .where(
        and(
          withTenant(orgUnits),
          inArray(orgUnitMembers.userId, userIds),
        ),
      )
      .orderBy(sql`coalesce(${orgPositions.sortOrder}, 999999)`);

    const byUser: Record<string, Array<{ unitId: string; unitName: string; positionId: string | null; positionName: string | null }>> = {};
    for (const row of rows) {
      const list = byUser[row.userId] ?? [];
      list.push({
        unitId: row.unitId,
        unitName: row.unitName,
        positionId: row.positionId,
        positionName: row.positionName,
      });
      byUser[row.userId] = list;
    }
    return byUser;
  }

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
