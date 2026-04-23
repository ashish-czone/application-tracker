import { DatabaseService, eq } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import type { UserResolution, EntityResolverConfig } from '@packages/automation-contracts';
import type { UserResolverStrategy, UserResolutionContext } from '@packages/automation-contracts';

/**
 * Accepts either a string (single user id) or a string array (multi-user
 * field — e.g. a mention list in a note payload). Anything else normalises
 * to an empty list so callers can treat the result uniformly.
 */
function coerceUserIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

/**
 * Resolves users from a field on the source entity (e.g., assigneeId, ownerId).
 *
 * Config: { field: 'assigneeId' }
 *
 * Resolution order:
 * 1. Event payload (if available)
 * 2. Entity data passed in context
 * 3. DB query via entity resolver registry
 */
export class EntityFieldStrategy implements UserResolverStrategy {
  readonly type = 'entity_field';
  readonly label = 'Field on Entity';
  readonly configSchema = {
    field: { type: 'string', required: true, label: 'User field' },
  };

  constructor(
    private readonly database: DatabaseService,
    private readonly getEntityResolver: (entityType: string) => EntityResolverConfig | undefined,
  ) {}

  async resolve(resolution: UserResolution, context: UserResolutionContext): Promise<string[]> {
    const field = resolution.config?.field as string | undefined;
    if (!field) return [];

    // 1. Try event payload
    if (context.event?.payload) {
      const fromPayload = context.event.payload[field];
      const resolved = coerceUserIds(fromPayload);
      if (resolved.length > 0) return resolved;
    }

    // 2. Try entity data in context
    if (context.entityData) {
      const fromData = context.entityData[field];
      const resolved = coerceUserIds(fromData);
      if (resolved.length > 0) return resolved;
    }

    // 3. Fall back to DB query
    const entityType = context.entityType ?? context.event?.entityType;
    const entityId = context.entityId ?? context.event?.entityId;
    if (!entityType || !entityId) return [];

    const resolver = this.getEntityResolver(entityType);
    if (!resolver) return [];

    const idColumn = (resolver.table as Record<string, any>).id;
    const fieldColumn = (resolver.table as Record<string, any>)[field];
    if (!fieldColumn) return [];

    const [row] = await this.database.db
      .select({ value: fieldColumn })
      .from(resolver.table)
      .where(withTenant(resolver.table as any, eq(idColumn, entityId)))
      .limit(1);

    return coerceUserIds(row?.value);
  }
}
