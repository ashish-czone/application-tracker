import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, or, ilike, inArray, sql } from '@packages/database';
import { AppLoggerService, ContextLogger } from '@packages/logger';
import type { LookupConfig, LookupResult } from '../types';

/**
 * Module-level singleton registry shared across all LookupResolverService instances.
 * Webpack/SWC bundling can cause NestJS to create multiple service instances when
 * barrel re-exports produce different class references. Using a shared registry
 * ensures registrations from onApplicationBootstrap are visible to all instances.
 */
const sharedRegistry = new Map<string, LookupConfig>();

@Injectable()
export class LookupResolverService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(LookupResolverService.name);
  }

  /**
   * Register an entity as a lookup target.
   * Called in onModuleInit by domain modules.
   */
  register(config: LookupConfig): void {
    sharedRegistry.set(config.entity, config);
    this.logger.log(`Registered lookup target: ${config.entity}`);
  }

  /**
   * Check if an entity is registered as a lookup target.
   */
  isRegistered(entity: string): boolean {
    return sharedRegistry.has(entity);
  }

  /**
   * Get all registered entity names.
   */
  getRegisteredEntities(): string[] {
    return Array.from(sharedRegistry.keys());
  }

  /**
   * Get the lookup config for a registered entity.
   * Returns undefined if the entity is not registered.
   */
  getConfig(entity: string): LookupConfig | undefined {
    return sharedRegistry.get(entity);
  }

  /**
   * Search for lookup values by query string.
   * Returns label/value pairs for dropdown population.
   */
  async search(entity: string, query: string, limit = 20): Promise<LookupResult[]> {
    const config = sharedRegistry.get(entity);
    if (!config) {
      this.logger.warn(`Lookup entity '${entity}' is not registered`);
      return [];
    }

    const { table, labelField, labelFields, valueField, searchFields } = config;

    // Build search conditions across all search fields
    const searchConditions = searchFields
      .map(field => {
        const column = table[field];
        if (!column) return undefined;
        return ilike(column, `%${query}%`);
      })
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    if (searchConditions.length === 0) return [];

    // Build label select: composite (concat with space) or single field
    const labelSelect = labelFields && labelFields.length > 1
      ? sql.join(labelFields.map(f => table[f]), sql` || ' ' || `)
      : table[labelField];

    const rows = await this.database.db
      .select({
        label: labelSelect,
        value: table[valueField],
      })
      .from(table)
      .where(searchConditions.length === 1 ? searchConditions[0] : or(...searchConditions))
      .limit(limit);

    return rows.map(r => ({
      label: String(r.label ?? ''),
      value: String(r.value ?? ''),
    }));
  }

  /**
   * Resolve a single value to its display label.
   */
  async getLabel(entity: string, value: string): Promise<string | null> {
    const config = sharedRegistry.get(entity);
    if (!config) return null;

    const { table, labelField, labelFields, valueField } = config;

    const labelSelect = labelFields && labelFields.length > 1
      ? sql.join(labelFields.map(f => table[f]), sql` || ' ' || `)
      : table[labelField];

    const [row] = await this.database.db
      .select({ label: labelSelect })
      .from(table)
      .where(eq(table[valueField], value))
      .limit(1);

    return row ? String(row.label ?? '') : null;
  }

  /**
   * Bulk resolve values to labels.
   * Returns a Map of value -> label.
   */
  async getBatchLabels(entity: string, values: string[]): Promise<Map<string, string>> {
    const config = sharedRegistry.get(entity);
    if (!config || values.length === 0) return new Map();

    const { table, labelField, labelFields, valueField } = config;

    const labelSelect = labelFields && labelFields.length > 1
      ? sql.join(labelFields.map(f => table[f]), sql` || ' ' || `)
      : table[labelField];

    const rows = await this.database.db
      .select({
        label: labelSelect,
        value: table[valueField],
      })
      .from(table)
      .where(inArray(table[valueField], values));

    const result = new Map<string, string>();
    for (const row of rows) {
      result.set(String(row.value ?? ''), String(row.label ?? ''));
    }
    return result;
  }
}
