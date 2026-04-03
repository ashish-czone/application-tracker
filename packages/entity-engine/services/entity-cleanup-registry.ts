import { Injectable, Logger } from '@nestjs/common';

/**
 * Handler called during entity soft-delete to clean up related data (notes, attachments, etc.)
 * within the same transaction as the entity deletion.
 */
export type EntityCleanupHandler = (
  entityType: string,
  entityId: string,
  actorId: string,
  tx: any,
) => Promise<void>;

/**
 * Registry for entity cleanup handlers.
 * Packages register handlers in onModuleInit() to cascade soft-deletes
 * when a parent entity is deleted.
 */
@Injectable()
export class EntityCleanupRegistry {
  private readonly handlers = new Map<string, EntityCleanupHandler>();
  private readonly logger = new Logger(EntityCleanupRegistry.name);

  register(name: string, handler: EntityCleanupHandler): void {
    if (this.handlers.has(name)) {
      this.logger.warn(`Overwriting cleanup handler: ${name}`);
    }
    this.handlers.set(name, handler);
    this.logger.log(`Registered cleanup handler: ${name}`);
  }

  async runAll(entityType: string, entityId: string, actorId: string, tx: any): Promise<void> {
    for (const [name, handler] of this.handlers) {
      await handler(entityType, entityId, actorId, tx);
    }
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  get size(): number {
    return this.handlers.size;
  }
}
