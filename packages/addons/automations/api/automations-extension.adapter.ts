import { Injectable } from '@nestjs/common';
import type { AutomationsExtension, ActionHandlerDef, EntityResolverConfig } from '@packages/entity-engine/extensions';
import { ActionRegistry, EntityResolverRegistry } from '@packages/automation-contracts';

/**
 * Adapter that implements entity-engine's AutomationsExtension interface
 * by delegating to ActionRegistry and EntityResolverRegistry.
 */
@Injectable()
export class AutomationsExtensionAdapter implements AutomationsExtension {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly entityResolverRegistry: EntityResolverRegistry,
  ) {}

  registerAction(handler: ActionHandlerDef): void {
    this.actionRegistry.register(handler as any);
  }

  registerEntityResolver(entityType: string, config: EntityResolverConfig): void {
    this.entityResolverRegistry.register(entityType, config as any);
  }
}
