import { Injectable, Logger } from '@nestjs/common';
import type { EntityConfig, EntityRegistryEntry } from './types';

/**
 * Central registry of all entity types.
 * Each entity module registers its config here during module initialization.
 * The registry is the single source of truth for what entities exist in the system.
 */
@Injectable()
export class EntityRegistryService {
  private readonly configs = new Map<string, EntityConfig>();
  private readonly logger = new Logger(EntityRegistryService.name);

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
      const boardFields = [...workflowFields, ...(config.ui.boardFields ?? [])];
      // Deduplicate in case a workflow field is also explicitly listed
      const uniqueBoardFields = [...new Set(boardFields)];

      return {
      entityType: config.entityType,
      singularName: config.singularName,
      pluralName: config.pluralName,
      slug: config.slug,
      ui: { ...config.ui, boardFields: uniqueBoardFields.length > 0 ? uniqueBoardFields : undefined },
      features: {
        softDelete: !!(config.table as any).deletedAt,
        restore: !!(config.table as any).deletedAt,
        customFields: !!config.customFields,
        hasTaxonomy: Object.values(config.fieldMeta).some(f => f.fieldType === 'tags'),
        hasWorkflow: Object.values(config.fieldMeta).some(f => f.fieldType === 'workflow'),
        hasMedia: Object.values(config.fieldMeta).some(f => f.fieldType === 'file'),
        hasNotes: !!config.hasNotes,
        hasAttachments: !!config.hasAttachments,
        attachmentConfig: config.attachmentConfig ? {
          maxFileSize: config.attachmentConfig.maxFileSize,
          acceptedMimeTypes: config.attachmentConfig.acceptedMimeTypes,
          deleteMode: config.attachmentConfig.deleteMode,
        } : undefined,
        workflowDiscriminator: (() => {
          for (const [fieldKey, meta] of Object.entries(config.fieldMeta)) {
            if (meta.fieldType === 'workflow' && meta.workflow?.discriminator) {
              const d = meta.workflow.discriminator;
              return { key: d.key, label: d.label, options: d.options, fieldName: fieldKey };
            }
          }
          return null;
        })(),
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
}
