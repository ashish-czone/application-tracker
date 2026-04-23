import { DatabaseService, and, eq, isNull } from '@packages/database';
import { users } from '@packages/database/schema';
import type {
  EntityResolverConfig,
  UserResolution,
  UserResolutionContext,
  UserResolverStrategy,
} from '@packages/automation-contracts';
import { orgUnitMembers } from '../schema/org-unit-members';
import { resolveUnitIdFromContext } from './unit-id-helper';

/**
 * Resolves to every member of the target unit, regardless of position.
 * Used for broadcast notifications (e.g. the tier-1 escalation fires to
 * the whole team when a task has no individual assignee — Q20).
 *
 * Deactivated users (`users.deletedAt IS NOT NULL`) are filtered out via
 * an inner join so a stale `org_unit_members` row cannot leak a
 * terminated employee into a recipient list (Q32).
 *
 * Config: `{ unitField: 'assigneeTeamId' }` — the field on the source
 * entity that holds the org-unit id.
 */
export class OrgUnitMembersStrategy implements UserResolverStrategy {
  readonly type = 'org_unit_members';
  readonly label = 'Org Unit Members';
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

    const rows = await this.database.db
      .select({ userId: orgUnitMembers.userId })
      .from(orgUnitMembers)
      .innerJoin(users, eq(users.id, orgUnitMembers.userId))
      .where(and(eq(orgUnitMembers.orgUnitId, unitId), isNull(users.deletedAt)));

    return rows.map((r) => r.userId);
  }
}
