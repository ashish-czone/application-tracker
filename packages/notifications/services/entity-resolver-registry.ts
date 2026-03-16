import { Injectable, Logger } from '@nestjs/common';
import type { EntityResolverConfig } from '../types';

@Injectable()
export class EntityResolverRegistry {
  private readonly logger = new Logger(EntityResolverRegistry.name);
  private readonly resolvers = new Map<string, EntityResolverConfig>();

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
}
