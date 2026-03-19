import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { EntityResolverConfig, ResolvedFieldConfig, RecipientFieldConfig } from '../types';

@Injectable()
export class EntityResolverRegistry {
  private readonly logger: ContextLogger;
  private readonly resolvers = new Map<string, EntityResolverConfig>();

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(EntityResolverRegistry.name);
  }

  /**
   * Register an entity type with its Drizzle table, field metadata, and recipient fields.
   * Called by domain modules in onModuleInit.
   *
   * @example
   * entityResolverRegistry.register('tasks', {
   *   table: tasks,
   *   fields: {
   *     status: { type: 'enum', label: 'Status', options: ['pending', 'in_progress', 'completed'] },
   *     dueDate: { type: 'date', label: 'Due Date' },
   *     amount: { type: 'number', label: 'Amount' },
   *   },
   *   recipientFields: {
   *     assigneeId: { label: 'Assignee' },
   *     createdBy: { label: 'Creator' },
   *   },
   * });
   */
  register(entityType: string, config: EntityResolverConfig): void {
    this.resolvers.set(entityType, config);
    const fieldNames = Object.keys(config.fields);
    const recipientNames = Object.keys(config.recipientFields);
    this.logger.log(`Registered entity resolver: ${entityType} (fields: ${fieldNames.join(', ')}, recipients: ${recipientNames.join(', ')})`);
  }

  get(entityType: string): EntityResolverConfig | undefined {
    return this.resolvers.get(entityType);
  }

  /** Get the list of filterable field names for condition building. */
  getFilterableFields(entityType: string): string[] {
    const config = this.resolvers.get(entityType);
    return config ? Object.keys(config.fields) : [];
  }

  has(entityType: string): boolean {
    return this.resolvers.has(entityType);
  }

  getAll(): Map<string, EntityResolverConfig> {
    return this.resolvers;
  }

  /**
   * Resolve all dynamic options for an entity's fields.
   * Calls resolveOptions() where configured, returns a clean config without functions.
   */
  async resolveAllFields(entityType: string): Promise<{
    fields: Record<string, ResolvedFieldConfig>;
    recipientFields: Record<string, RecipientFieldConfig>;
  } | null> {
    const config = this.resolvers.get(entityType);
    if (!config) return null;

    const resolvedFields: Record<string, ResolvedFieldConfig> = {};

    for (const [fieldName, fieldConfig] of Object.entries(config.fields)) {
      let options = fieldConfig.options;

      if (fieldConfig.resolveOptions) {
        try {
          options = await fieldConfig.resolveOptions();
        } catch (error) {
          this.logger.warn(`Failed to resolve options for ${entityType}.${fieldName}: ${error}`);
          options = [];
        }
      }

      resolvedFields[fieldName] = {
        type: fieldConfig.type,
        label: fieldConfig.label,
        ...(options && options.length > 0 ? { options } : {}),
      };
    }

    return {
      fields: resolvedFields,
      recipientFields: config.recipientFields,
    };
  }
}
