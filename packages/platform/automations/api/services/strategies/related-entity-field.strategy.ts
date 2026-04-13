import { DatabaseService, eq } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import type { UserResolution, EntityResolverConfig } from '@packages/automation-contracts';
import type { UserResolverStrategy, UserResolutionContext } from '@packages/automation-contracts';

/**
 * Resolves users from a field on a *related* entity — one lookup hop away.
 *
 * Use case: application's job opening has a hiringManager field.
 *   Config: { throughField: 'jobOpeningId', throughEntityType: 'job_openings', targetField: 'hiringManager' }
 *
 * Resolution order for the throughField value:
 * 1. Event payload (if available)
 * 2. Entity data passed in context
 * 3. DB query on the source entity
 *
 * Then queries the related entity to read the targetField (user ID).
 */
export class RelatedEntityFieldStrategy implements UserResolverStrategy {
  readonly type = 'related_entity_field';
  readonly label = 'Field on Related Entity';
  readonly configSchema = {
    throughField: { type: 'string', required: true, label: 'Lookup field on source entity (e.g. jobOpeningId)' },
    throughEntityType: { type: 'string', required: true, label: 'Related entity type (e.g. job_openings)' },
    targetField: { type: 'string', required: true, label: 'User field on related entity (e.g. hiringManager)' },
  };

  constructor(
    private readonly database: DatabaseService,
    private readonly getEntityResolver: (entityType: string) => EntityResolverConfig | undefined,
  ) {}

  async resolve(resolution: UserResolution, context: UserResolutionContext): Promise<string[]> {
    const throughField = resolution.config?.throughField as string | undefined;
    const throughEntityType = resolution.config?.throughEntityType as string | undefined;
    const targetField = resolution.config?.targetField as string | undefined;

    if (!throughField || !throughEntityType || !targetField) return [];

    // Step 1: Resolve the FK value from the source entity
    const relatedId = await this.resolveRelatedId(throughField, context);
    if (!relatedId) return [];

    // Step 2: Look up the user field on the related entity
    const relatedResolver = this.getEntityResolver(throughEntityType);
    if (!relatedResolver) return [];

    const idColumn = (relatedResolver.table as Record<string, any>).id;
    const fieldColumn = (relatedResolver.table as Record<string, any>)[targetField];
    if (!fieldColumn) return [];

    const [row] = await this.database.db
      .select({ value: fieldColumn })
      .from(relatedResolver.table)
      .where(withTenant(relatedResolver.table as any, eq(idColumn, relatedId)))
      .limit(1);

    if (!row?.value) return [];

    // Support both single user fields and multi-user fields (array of UUIDs)
    if (Array.isArray(row.value)) {
      return row.value.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0);
    }

    return [row.value as string];
  }

  /**
   * Resolve the FK value (e.g. jobOpeningId) from event payload, context data, or DB.
   */
  private async resolveRelatedId(
    throughField: string,
    context: UserResolutionContext,
  ): Promise<string | null> {
    // 1. Try event payload (after snapshot has the current state)
    if (context.event?.payload) {
      const after = context.event.payload.after as Record<string, unknown> | undefined;
      if (after?.[throughField]) return after[throughField] as string;
      // Also check top-level payload
      if (context.event.payload[throughField]) return context.event.payload[throughField] as string;
    }

    // 2. Try entity data in context
    if (context.entityData?.[throughField]) {
      return context.entityData[throughField] as string;
    }

    // 3. Fall back to DB query on source entity
    const entityType = context.entityType ?? context.event?.entityType;
    const entityId = context.entityId ?? context.event?.entityId;
    if (!entityType || !entityId) return null;

    const sourceResolver = this.getEntityResolver(entityType);
    if (!sourceResolver) return null;

    const idColumn = (sourceResolver.table as Record<string, any>).id;
    const fieldColumn = (sourceResolver.table as Record<string, any>)[throughField];
    if (!fieldColumn) return null;

    const [row] = await this.database.db
      .select({ value: fieldColumn })
      .from(sourceResolver.table)
      .where(withTenant(sourceResolver.table as any, eq(idColumn, entityId)))
      .limit(1);

    return (row?.value as string) ?? null;
  }
}
