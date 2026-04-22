import { DatabaseService, eq } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import type {
  EntityResolverConfig,
  UserResolution,
  UserResolutionContext,
  UserResolverStrategy,
} from '@packages/automation-contracts';
import { orgUnits } from '../schema/org-units';
import { orgUnitMembers } from '../schema/org-unit-members';
import { orgPositions } from '../schema/org-positions';
import { resolveUnitIdFromContext } from './unit-id-helper';

/**
 * Resolves to the head(s) of the parent of the target unit. If the target
 * unit has no parent (it's a root), returns an empty array — the caller
 * handles that as "no one to escalate to".
 *
 * Config: `{ unitField: 'assigneeTeamId' }` — the field on the source
 * entity that holds the org-unit id of the starting unit.
 */
export class ParentUnitHeadStrategy implements UserResolverStrategy {
  readonly type = 'parent_unit_head';
  readonly label = 'Parent Org Unit Head(s)';
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

    const [unit] = await this.database.db
      .select({ parentId: orgUnits.parentId })
      .from(orgUnits)
      .where(withTenant(orgUnits, eq(orgUnits.id, unitId)))
      .limit(1);

    if (!unit?.parentId) return [];

    const rows = await this.database.db
      .select({
        userId: orgUnitMembers.userId,
        sortOrder: orgPositions.sortOrder,
      })
      .from(orgUnitMembers)
      .leftJoin(orgPositions, eq(orgPositions.id, orgUnitMembers.positionId))
      .where(eq(orgUnitMembers.orgUnitId, unit.parentId));

    const positioned = rows.filter((r): r is { userId: string; sortOrder: number } => r.sortOrder != null);
    if (positioned.length === 0) return [];

    const minSortOrder = positioned.reduce(
      (min, r) => (r.sortOrder < min ? r.sortOrder : min),
      positioned[0]!.sortOrder,
    );
    return positioned.filter((r) => r.sortOrder === minSortOrder).map((r) => r.userId);
  }
}
