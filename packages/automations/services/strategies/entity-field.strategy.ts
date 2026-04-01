import { DatabaseService, eq } from '@packages/database';
import type { UserResolution } from '../../types';
import type { EntityResolverConfig } from '../../types';
import type { UserResolverStrategy, UserResolutionContext } from '../user-resolver-registry';

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
      const fromPayload = context.event.payload[field] as string | undefined;
      if (fromPayload) return [fromPayload];
    }

    // 2. Try entity data in context
    if (context.entityData) {
      const fromData = context.entityData[field] as string | undefined;
      if (fromData) return [fromData];
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
      .where(eq(idColumn, entityId))
      .limit(1);

    if (!row?.value) return [];
    return [row.value as string];
  }
}
