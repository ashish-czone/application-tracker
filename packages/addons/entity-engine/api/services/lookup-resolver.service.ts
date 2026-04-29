import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, or, ilike, inArray, sql } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import { AppLoggerService, ContextLogger } from '@packages/logger';
import type { CustomLookupResolver, LookupConfig, LookupResult } from '../types';

@Injectable()
export class LookupResolverService {
  private readonly logger: ContextLogger;
  private readonly configs = new Map<string, LookupConfig>();
  private readonly resolvers = new Map<string, CustomLookupResolver>();

  constructor(
    private readonly database: DatabaseService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(LookupResolverService.name);
  }

  /**
   * Register an entity using the default table-based resolver. Builds a
   * `CustomLookupResolver` from the config and stores it under the entity's
   * name. Called in onModuleInit by domain modules and by `defineEntity()`.
   */
  register(config: LookupConfig): void {
    this.configs.set(config.entity, config);
    this.resolvers.set(config.entity, this.buildTableResolver(config));
    this.logger.log(`Registered lookup target: ${config.entity}`);
  }

  /**
   * Register a custom resolver for an entity whose labels can't be expressed
   * as a single-table query — e.g. clients projecting `companies.name` via
   * the `companyId` FK. Replaces any previously registered resolver for the
   * same entity.
   */
  registerResolver(entity: string, resolver: CustomLookupResolver): void {
    this.resolvers.set(entity, resolver);
    this.logger.log(`Registered custom lookup resolver: ${entity}`);
  }

  /**
   * Check if an entity is registered as a lookup target.
   */
  isRegistered(entity: string): boolean {
    return this.resolvers.has(entity);
  }

  /**
   * Get all registered entity names.
   */
  getRegisteredEntities(): string[] {
    return Array.from(this.resolvers.keys());
  }

  /**
   * Clear all registrations. Only for use in tests.
   */
  clearRegistry(): void {
    this.configs.clear();
    this.resolvers.clear();
  }

  /**
   * Get the table-based config for a registered entity. Returns undefined
   * for entities registered via `registerResolver` (custom resolvers don't
   * expose a `LookupConfig`).
   */
  getConfig(entity: string): LookupConfig | undefined {
    return this.configs.get(entity);
  }

  /**
   * Search for lookup values by query string.
   * Returns label/value pairs for dropdown population.
   */
  async search(entity: string, query: string, limit = 20): Promise<LookupResult[]> {
    const resolver = this.resolvers.get(entity);
    if (!resolver) {
      this.logger.warn(`Lookup entity '${entity}' is not registered`);
      return [];
    }
    return resolver.search(query, limit);
  }

  /**
   * Resolve a single value to its display label.
   */
  async getLabel(entity: string, value: string): Promise<string | null> {
    const resolver = this.resolvers.get(entity);
    if (!resolver) return null;
    return resolver.getLabel(value);
  }

  /**
   * Bulk resolve values to labels.
   * Returns a Map of value -> label.
   */
  async getBatchLabels(entity: string, values: string[]): Promise<Map<string, string>> {
    const resolver = this.resolvers.get(entity);
    if (!resolver || values.length === 0) return new Map();
    return resolver.getBatchLabels(values);
  }

  // ---------------------------------------------------------------------------
  // Default table-based resolver
  // ---------------------------------------------------------------------------

  /**
   * Builds a `CustomLookupResolver` from a `LookupConfig` — runs the same
   * single-table queries the service used inline before the dispatcher
   * refactor. This is the default for `defineEntity()`-driven entities.
   */
  private buildTableResolver(config: LookupConfig): CustomLookupResolver {
    const { table, labelField, labelFields, valueField, searchFields } = config;
    const labelSelect = labelFields && labelFields.length > 1
      ? sql.join(labelFields.map(f => table[f]), sql` || ' ' || `)
      : table[labelField];

    return {
      search: async (query, limit) => {
        const searchConditions = searchFields
          .map(field => {
            const column = table[field];
            if (!column) return undefined;
            return ilike(column, `%${query}%`);
          })
          .filter((c): c is NonNullable<typeof c> => c !== undefined);

        if (searchConditions.length === 0) return [];

        const rows = await this.database.db
          .select({ label: labelSelect, value: table[valueField] })
          .from(table)
          .where(withTenant(table, searchConditions.length === 1 ? searchConditions[0] : or(...searchConditions)))
          .limit(limit);

        return rows.map(r => ({
          label: String(r.label ?? ''),
          value: String(r.value ?? ''),
        }));
      },

      getLabel: async (value) => {
        const [row] = await this.database.db
          .select({ label: labelSelect })
          .from(table)
          .where(withTenant(table, eq(table[valueField], value)))
          .limit(1);
        return row ? String(row.label ?? '') : null;
      },

      getBatchLabels: async (values) => {
        const rows = await this.database.db
          .select({ label: labelSelect, value: table[valueField] })
          .from(table)
          .where(withTenant(table, inArray(table[valueField], values)));

        const result = new Map<string, string>();
        for (const row of rows) {
          result.set(String(row.value ?? ''), String(row.label ?? ''));
        }
        return result;
      },
    };
  }
}
