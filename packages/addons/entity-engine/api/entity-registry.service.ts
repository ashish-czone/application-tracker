import { Injectable, Logger } from '@nestjs/common';
import { getTableColumns } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { hasSoftDeleteColumns } from '@packages/soft-delete';
import type { EntityConfig, EntityRegistryEntry } from './types';
import { FeatureDeriverRegistry } from './services/feature-deriver.registry';
import { ensureRegisteredIdentity } from './helpers/registered-identity';

/**
 * Resolved Drizzle column references for an entity's search/sort field keys.
 * Cached at finalize() so the read path never re-walks getTableColumns().
 */
interface ResolvedReadColumns {
  searchColumns: PgColumn[];
  sortableColumns: Record<string, PgColumn>;
}

/**
 * Post-register form of `EntityConfig`. Identity strings the engine needs
 * for log messages, error messages, and event descriptions are guaranteed
 * to be present — the registry populates them from a humanized slug
 * fallback when the input config omits them. Consumers that only ever
 * read configs back from the registry can rely on these being defined.
 */
export type RegisteredEntityConfig = EntityConfig & {
  singularName: string;
  pluralName: string;
};

/**
 * Central registry of all entity types.
 * Each entity module registers its config here during module initialization.
 * The registry is the single source of truth for what entities exist in the system.
 */
@Injectable()
export class EntityRegistryService {
  private readonly configs = new Map<string, RegisteredEntityConfig>();
  private readonly resolvedReadColumns = new Map<string, ResolvedReadColumns>();
  private finalized = false;
  private readonly logger = new Logger(EntityRegistryService.name);

  constructor(private readonly featureDerivers: FeatureDeriverRegistry) {}

  /**
   * Register an entity config. Called by EntityEngineModule.forEntity() during init.
   * Throws if the entity type is already registered (prevents duplicate registrations).
   *
   * If the config omits `singularName` / `pluralName`, the registry derives a
   * humanized form from the slug so the engine's user-facing strings (logger
   * messages, NotFoundException messages) always have something to render
   * even when the FE-side `EntityUIConfig.presentation` carries the canonical
   * names. The mutation happens on the same object the caller passed in —
   * downstream readers see the populated names.
   */
  register(config: EntityConfig): void {
    if (this.configs.has(config.entityType)) {
      throw new Error(`Entity type "${config.entityType}" is already registered`);
    }
    ensureRegisteredIdentity(config);
    this.configs.set(config.entityType, config as RegisteredEntityConfig);
    this.logger.log(`Registered entity: ${config.entityType} (/${config.slug})`);
  }

  /** Get a config by entity type. Returns undefined if not registered. */
  get(entityType: string): RegisteredEntityConfig | undefined {
    return this.configs.get(entityType);
  }

  /** Get a config by entity type. Throws if not registered. */
  getOrFail(entityType: string): RegisteredEntityConfig {
    const config = this.configs.get(entityType);
    if (!config) {
      throw new Error(`Entity type "${entityType}" is not registered`);
    }
    return config;
  }

  /** Get a config by slug (URL path). */
  getBySlug(slug: string): RegisteredEntityConfig | undefined {
    for (const config of this.configs.values()) {
      if (config.slug === slug) return config;
    }
    return undefined;
  }

  /** Get all registered configs. */
  getAll(): RegisteredEntityConfig[] {
    return Array.from(this.configs.values());
  }

  /** Get all entity types as serializable registry entries (for frontend consumption). */
  getRegistryEntries(): EntityRegistryEntry[] {
    return this.getAll().map((config) => {
      return {
      entityType: config.entityType,
      singularName: config.singularName,
      pluralName: config.pluralName,
      slug: config.slug,
      nameField: config.nameField,
      subtitleField: config.subtitleField,
      features: {
        // Engine-derived flags. Addons must not register keys with these names.
        // Soft-delete capability comes from the schema (presence of
        // softDeleteColumns) — schema is the source of truth, no config flag.
        softDelete: hasSoftDeleteColumns(config.table),
        restore: hasSoftDeleteColumns(config.table),
        customFields: !!config.customFields,
        adminConfigurable: !!config.adminConfigurable,
        hasTaxonomy: Object.values(config.fieldMeta).some(f => f.fieldType === 'tags'),
        hasMedia: Object.values(config.fieldMeta).some(f => f.fieldType === 'file'),
        // Feature-package-derived keys (workflows, ...). Each feature package
        // registers a deriver in onModuleInit; the engine merges results
        // verbatim and never inspects the keys.
        ...this.featureDerivers.derive(config),
        // Opaque addon-owned bag. Forwarded verbatim; the engine does not
        // inspect these keys. Each addon ships a reader for its own key.
        ...(config.features ?? {}),
      },
      relationships: (config.relationships ?? []).map(({ name, type, targetEntity, foreignKey, label, displayFields }) => ({
        name,
        foreignKey,
        type,
        targetEntity,
        label,
        displayFields,
      })),
      };
    });
  }

  /** Get count of registered entities. */
  get size(): number {
    return this.configs.size;
  }

  /**
   * Resolve every entity's search/sort field keys to actual Drizzle columns.
   * Idempotent — calling again is a no-op. Throws on the first unknown field
   * key so misconfigurations surface at boot, not at first request.
   */
  finalize(): void {
    if (this.finalized) return;

    for (const config of this.configs.values()) {
      this.resolvedReadColumns.set(config.entityType, this.resolveReadColumns(config));
    }

    this.finalized = true;
  }

  /**
   * Look up the resolved Drizzle columns for an entity's `searchFields` and
   * `sortableFields`. Throws if `finalize()` has not run, or if the entity is
   * not registered. Always returns a frozen-shape object — callers may treat
   * the maps as read-only.
   */
  getResolvedReadColumns(entityType: string): ResolvedReadColumns {
    if (!this.finalized) {
      throw new Error(
        `EntityRegistryService.getResolvedReadColumns('${entityType}') called before finalize()`,
      );
    }
    const resolved = this.resolvedReadColumns.get(entityType);
    if (!resolved) {
      throw new Error(`Entity '${entityType}' is not registered`);
    }
    return resolved;
  }

  private resolveReadColumns(config: EntityConfig): ResolvedReadColumns {
    const tableColumns = getTableColumns(config.table) as Record<string, PgColumn>;

    const searchColumns: PgColumn[] = [];
    for (const key of config.searchFields ?? []) {
      const col = tableColumns[key];
      if (!col) {
        throw new Error(
          `Entity '${config.entityType}': searchFields includes '${key}', which is not a column on the table.`,
        );
      }
      searchColumns.push(col);
    }

    const sortableColumns: Record<string, PgColumn> = {};
    for (const key of config.sortableFields ?? []) {
      const col = tableColumns[key];
      if (!col) {
        throw new Error(
          `Entity '${config.entityType}': sortableFields includes '${key}', which is not a column on the table.`,
        );
      }
      sortableColumns[key] = col;
    }

    // Mirror prior define-entity behavior: defaultSort is always sortable when
    // it maps to a real column, even if the consumer forgot to list it.
    if (
      config.defaultSort
      && tableColumns[config.defaultSort]
      && !sortableColumns[config.defaultSort]
    ) {
      sortableColumns[config.defaultSort] = tableColumns[config.defaultSort];
    }

    return { searchColumns, sortableColumns };
  }
}
