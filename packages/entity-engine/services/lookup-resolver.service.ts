import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, or, ilike, inArray } from '@packages/database';
import { AppLoggerService, ContextLogger } from '@packages/logger';
import type { LookupConfig, LookupResult } from '../types';

@Injectable()
export class LookupResolverService {
  private readonly registry = new Map<string, LookupConfig>();
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
    this.registry.set(config.entity, config);
    this.logger.log(`Registered lookup target: ${config.entity}`);
  }

  /**
   * Check if an entity is registered as a lookup target.
   */
  isRegistered(entity: string): boolean {
    return this.registry.has(entity);
  }

  /**
   * Get all registered entity names.
   */
  getRegisteredEntities(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get the lookup config for a registered entity.
   * Returns undefined if the entity is not registered.
   */
  getConfig(entity: string): LookupConfig | undefined {
    return this.registry.get(entity);
  }

  /**
   * Search for lookup values by query string.
   * Returns label/value pairs for dropdown population.
   */
  async search(entity: string, query: string, limit = 20): Promise<LookupResult[]> {
    const config = this.registry.get(entity);
    if (!config) {
      this.logger.warn(`Lookup entity '${entity}' is not registered`);
      return [];
    }

    const { table, labelField, valueField, searchFields } = config;

    // Build search conditions across all search fields
    const searchConditions = searchFields
      .map(field => {
        const column = table[field];
        if (!column) return undefined;
        return ilike(column, `%${query}%`);
      })
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    if (searchConditions.length === 0) return [];

    const rows = await this.database.db
      .select({
        label: table[labelField],
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
    const config = this.registry.get(entity);
    if (!config) return null;

    const { table, labelField, valueField } = config;

    const [row] = await this.database.db
      .select({ label: table[labelField] })
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
    const config = this.registry.get(entity);
    if (!config || values.length === 0) return new Map();

    const { table, labelField, valueField } = config;

    const rows = await this.database.db
      .select({
        label: table[labelField],
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
