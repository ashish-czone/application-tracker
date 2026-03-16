import { Injectable, Logger } from '@nestjs/common';
import type { EntityResolverConfig } from '../types';

@Injectable()
export class EntityResolverRegistry {
  private readonly logger = new Logger(EntityResolverRegistry.name);
  private readonly resolvers = new Map<string, EntityResolverConfig>();

  /**
   * Register an entity type with its Drizzle table and metadata.
   * Called by domain modules in onModuleInit.
   *
   * @example
   * entityResolverRegistry.register('tasks', {
   *   table: tasks,
   *   ownerField: 'assigneeId',
   *   filterableFields: ['status', 'priority', 'dueDate', 'assigneeId'],
   * });
   */
  register(entityType: string, config: EntityResolverConfig): void {
    this.resolvers.set(entityType, config);
    this.logger.log(`Registered entity resolver: ${entityType} (fields: ${config.filterableFields.join(', ')})`);
  }

  get(entityType: string): EntityResolverConfig | undefined {
    return this.resolvers.get(entityType);
  }

  has(entityType: string): boolean {
    return this.resolvers.has(entityType);
  }

  getAll(): Map<string, EntityResolverConfig> {
    return this.resolvers;
  }
}
