import { DatabaseService, eq } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import type {
  EntityResolverConfig,
  UserResolutionContext,
} from '@packages/automation-contracts';

/**
 * Extract an org-unit id from automation context by reading `unitField` on
 * the source entity (e.g. `assigneeTeamId` on a `tasks` row). Mirrors the
 * resolution order used by `EntityFieldStrategy` so behavior is consistent
 * across resolvers that read a single field off the source entity.
 *
 *   1. event payload (direct trigger)
 *   2. entityData supplied by the caller (scheduled scans)
 *   3. DB lookup via the entity-resolver registry
 */
export async function resolveUnitIdFromContext(
  unitField: string,
  context: UserResolutionContext,
  database: DatabaseService,
  getEntityResolver: (entityType: string) => EntityResolverConfig | undefined,
): Promise<string | null> {
  if (context.event?.payload) {
    const fromPayload = context.event.payload[unitField] as string | undefined;
    if (fromPayload) return fromPayload;
  }

  if (context.entityData) {
    const fromData = context.entityData[unitField] as string | undefined;
    if (fromData) return fromData;
  }

  const entityType = context.entityType ?? context.event?.entityType;
  const entityId = context.entityId ?? context.event?.entityId;
  if (!entityType || !entityId) return null;

  const resolver = getEntityResolver(entityType);
  if (!resolver) return null;

  const idColumn = (resolver.table as Record<string, any>).id;
  const fieldColumn = (resolver.table as Record<string, any>)[unitField];
  if (!fieldColumn) return null;

  const [row] = await database.db
    .select({ value: fieldColumn })
    .from(resolver.table)
    .where(withTenant(resolver.table as any, eq(idColumn, entityId)))
    .limit(1);

  return (row?.value as string | undefined) ?? null;
}
