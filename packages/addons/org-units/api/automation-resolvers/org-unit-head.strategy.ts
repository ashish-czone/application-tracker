import { DatabaseService, and, eq, isNull } from '@packages/database';
import { users } from '@packages/database/schema';
import type {
  EntityResolverConfig,
  UserResolution,
  UserResolutionContext,
  UserResolverStrategy,
} from '@packages/automation-contracts';
import { orgUnitMembers } from '../schema/org-unit-members';
import { orgPositions } from '../schema/org-positions';
import { resolveUnitIdFromContext } from './unit-id-helper';

/**
 * Resolves to the user(s) with the lowest `position.sortOrder` among the
 * target unit's members. Multiple users tied at the minimum are all
 * returned — co-heads are intentional (see Q3 in compliance/todos.md).
 *
 * Members without a position are excluded: "no position" means "not a head".
 * Deactivated users (`users.deletedAt IS NOT NULL`) are filtered out
 * (Q32) so a stale membership row cannot make a terminated employee the
 * resolved head.
 *
 * If no active, positioned member remains, returns an empty array — the
 * caller is responsible for rolling up to the parent unit if that matters.
 *
 * Config: `{ unitField: 'assigneeTeamId' }` — the field on the source
 * entity that holds the org-unit id.
 */
export class OrgUnitHeadStrategy implements UserResolverStrategy {
  readonly type = 'org_unit_head';
  readonly label = 'Org Unit Head(s)';
  readonly configSchema = {
    unitField: { type: 'string', required: true, label: 'Unit ID field on entity' },
  };

  constructor(
    private readonly database: DatabaseService,
    private readonly getEntityResolver: (entityType: string) => EntityResolverConfig | undefined,
  ) {}

  async resolve(resolution: UserResolution, context: UserResolutionContext): Promise<string[]> {
    const unitField = resolution.config?.unitField as string | undefined;
    if (!unitField) return [];

    const unitId = await resolveUnitIdFromContext(
      unitField,
      context,
      this.database,
      this.getEntityResolver,
    );
    if (!unitId) return [];

    return this.findHeadsOfUnit(unitId);
  }

  private async findHeadsOfUnit(unitId: string): Promise<string[]> {
    const rows = await this.database.db
      .select({
        userId: orgUnitMembers.userId,
        sortOrder: orgPositions.sortOrder,
      })
      .from(orgUnitMembers)
      .innerJoin(users, eq(users.id, orgUnitMembers.userId))
      .leftJoin(orgPositions, eq(orgPositions.id, orgUnitMembers.positionId))
      .where(and(eq(orgUnitMembers.orgUnitId, unitId), isNull(users.deletedAt)));

    const positioned = rows.filter((r): r is { userId: string; sortOrder: number } => r.sortOrder != null);
    if (positioned.length === 0) return [];

    const minSortOrder = positioned.reduce(
      (min, r) => (r.sortOrder < min ? r.sortOrder : min),
      positioned[0]!.sortOrder,
    );
    return positioned.filter((r) => r.sortOrder === minSortOrder).map((r) => r.userId);
  }
}
