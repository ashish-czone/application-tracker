import { Injectable, Logger } from '@nestjs/common';
import { getTableColumns } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { EntityConfig, EntityRegistryEntry, ResolvedExtension } from './types';
import { FeatureDeriverRegistry } from './services/feature-deriver.registry';

/**
 * Central registry of all entity types.
 * Each entity module registers its config here during module initialization.
 * The registry is the single source of truth for what entities exist in the system.
 */
@Injectable()
export class EntityRegistryService {
  private readonly configs = new Map<string, EntityConfig>();
  private readonly resolvedExtensions = new Map<string, ResolvedExtension>();
  private finalized = false;
  private readonly logger = new Logger(EntityRegistryService.name);

  constructor(private readonly featureDerivers: FeatureDeriverRegistry) {}

  /**
   * Register an entity config. Called by EntityEngineModule.forEntity() during init.
   * Throws if the entity type is already registered (prevents duplicate registrations).
   */
  register(config: EntityConfig): void {
    if (this.configs.has(config.entityType)) {
      throw new Error(`Entity type "${config.entityType}" is already registered`);
    }
    this.configs.set(config.entityType, config);
    this.logger.log(`Registered entity: ${config.entityType} (/${config.slug})`);
  }

  /** Get a config by entity type. Returns undefined if not registered. */
  get(entityType: string): EntityConfig | undefined {
    return this.configs.get(entityType);
  }

  /** Get a config by entity type. Throws if not registered. */
  getOrFail(entityType: string): EntityConfig {
    const config = this.configs.get(entityType);
    if (!config) {
      throw new Error(`Entity type "${entityType}" is not registered`);
    }
    return config;
  }

  /** Get a config by slug (URL path). */
  getBySlug(slug: string): EntityConfig | undefined {
    for (const config of this.configs.values()) {
      if (config.slug === slug) return config;
    }
    return undefined;
  }

  /** Get all registered configs. */
  getAll(): EntityConfig[] {
    return Array.from(this.configs.values());
  }

  /** Get all entity types as serializable registry entries (for frontend consumption). */
  getRegistryEntries(): EntityRegistryEntry[] {
    return this.getAll().map((config) => {
      // Derive boardFields: workflow fields automatically qualify as board grouping fields
      const workflowFields = Object.entries(config.fieldMeta)
        .filter(([, meta]) => meta.fieldType === 'workflow')
        .map(([key]) => key);
      const boardFields = [...workflowFields, ...(config.ui?.boardFields ?? [])];
      // Deduplicate in case a workflow field is also explicitly listed
      const uniqueBoardFields = [...new Set(boardFields)];

      return {
      entityType: config.entityType,
      singularName: config.singularName,
      pluralName: config.pluralName,
      slug: config.slug,
      ui: { ...config.ui, boardFields: uniqueBoardFields.length > 0 ? uniqueBoardFields : undefined },
      features: {
        // Engine-derived flags. Addons must not register keys with these names.
        softDelete: config.onDelete.mode === 'soft',
        restore: config.onDelete.mode === 'soft',
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

  // ---------------------------------------------------------------------------
  // Extension-of resolution — runs once after all entities are registered.
  // Walks each entity that declares `extensionOf`, looks up the parent in the
  // registry, computes the projected column set, and caches a `ResolvedExtension`
  // for downstream consumers (entity service, controllers).
  // ---------------------------------------------------------------------------

  /**
   * Resolve all `extensionOf` configs against their (now-registered) parents.
   * Idempotent — calling again is a no-op. Throws on the first invalid
   * extension so misconfigurations surface at boot, not at first request.
   */
  finalize(): void {
    if (this.finalized) return;

    for (const child of this.configs.values()) {
      if (!child.extensionOf) continue;
      this.resolvedExtensions.set(child.entityType, this.resolveExtension(child));
    }

    this.finalized = true;
    if (this.resolvedExtensions.size > 0) {
      this.logger.log(`Resolved ${this.resolvedExtensions.size} extension entities`);
    }
  }

  /** Returns the resolved extension metadata for an entity, or undefined if
   *  the entity is not an extension. Throws if the entity declares
   *  `extensionOf` but `finalize()` has not run yet — non-extension entities
   *  return undefined regardless so generic call sites don't have to know
   *  about the bootstrap order. */
  getResolvedExtension(entityType: string): ResolvedExtension | undefined {
    if (!this.finalized) {
      const config = this.configs.get(entityType);
      if (config?.extensionOf) {
        throw new Error(
          `EntityRegistryService.getResolvedExtension('${entityType}') called before finalize()`,
        );
      }
      return undefined;
    }
    return this.resolvedExtensions.get(entityType);
  }

  private resolveExtension(child: EntityConfig): ResolvedExtension {
    const ext = child.extensionOf!;
    const parent = this.configs.get(ext.entity);
    if (!parent) {
      throw new Error(
        `Entity '${child.entityType}' declares extensionOf '${ext.entity}', but '${ext.entity}' is not registered.`,
      );
    }
    if (parent.extensionOf) {
      throw new Error(
        `Entity '${child.entityType}' extends '${ext.entity}', which is itself an extension. ` +
          `Extension chaining is not supported.`,
      );
    }
    if (!parent.extensionColumns || parent.extensionColumns.length === 0) {
      throw new Error(
        `Entity '${child.entityType}' extends '${ext.entity}', but '${ext.entity}' does not declare ` +
          `any 'extensionColumns'. Add the field keys you want extensions to inherit on the parent's defineEntity().`,
      );
    }

    const childColumns = getTableColumns(child.table);
    const parentColumns = getTableColumns(parent.table);

    const fkColumn = childColumns[ext.foreignKey] as PgColumn | undefined;
    if (!fkColumn) {
      // Already validated at defineEntity time — this is a defensive guard.
      throw new Error(
        `Entity '${child.entityType}': extensionOf.foreignKey '${ext.foreignKey}' is not a column on the table.`,
      );
    }
    const parentIdColumn = parentColumns.id as PgColumn | undefined;
    if (!parentIdColumn) {
      throw new Error(
        `Entity '${ext.entity}' has no 'id' column. extensionOf requires the parent to expose an 'id' primary key.`,
      );
    }

    // Build projection set: parent.extensionColumns minus excludeColumns,
    // then extraColumns appended (preserving declared order in both).
    const excluded = new Set(ext.excludeColumns ?? []);
    for (const k of excluded) {
      if (!parent.extensionColumns.includes(k)) {
        throw new Error(
          `Entity '${child.entityType}': extensionOf.excludeColumns names '${k}', which is not in ` +
            `'${ext.entity}'.extensionColumns. Drop the entry or add it to the parent's extensionColumns.`,
        );
      }
    }

    const baseProjection = parent.extensionColumns.filter((k) => !excluded.has(k));
    const extras = ext.extraColumns ?? [];
    for (const k of extras) {
      if (parent.extensionColumns.includes(k)) {
        throw new Error(
          `Entity '${child.entityType}': extensionOf.extraColumns names '${k}', which is already in ` +
            `'${ext.entity}'.extensionColumns. Remove it from extraColumns.`,
        );
      }
      if (!parentColumns[k]) {
        throw new Error(
          `Entity '${child.entityType}': extensionOf.extraColumns names '${k}', which is not a column ` +
            `on '${ext.entity}'.`,
        );
      }
    }

    const projectedColumns: ResolvedExtension['projectedColumns'] = [
      ...baseProjection.map((fieldKey) => ({ fieldKey, column: parentColumns[fieldKey] as PgColumn })),
      ...extras.map((fieldKey) => ({ fieldKey, column: parentColumns[fieldKey] as PgColumn })),
    ];

    return {
      parentEntityType: ext.entity,
      parentTable: parent.table,
      foreignKeyColumn: fkColumn,
      foreignKeyField: ext.foreignKey,
      parentIdColumn,
      projectedColumns,
      parentDefaults: ext.parentDefaults ?? {},
    };
  }
}
