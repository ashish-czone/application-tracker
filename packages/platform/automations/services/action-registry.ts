import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { ActionHandler } from '../types';

@Injectable()
export class ActionRegistry {
  private readonly logger: ContextLogger;
  private readonly handlers = new Map<string, ActionHandler>();

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(ActionRegistry.name);
  }

  register(handler: ActionHandler): void {
    if (this.handlers.has(handler.type)) {
      this.logger.warn(`Overwriting action handler for type: ${handler.type}`);
    }
    this.handlers.set(handler.type, handler);
    this.logger.log(`Registered action handler: ${handler.type} ("${handler.label}")`);
  }

  get(type: string): ActionHandler | undefined {
    return this.handlers.get(type);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  getAll(): ActionHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Returns metadata for all registered actions — used by the
   * automations metadata API so the frontend can render action
   * type pickers and config forms.
   */
  getAllMetadata(): { type: string; label: string; userSlots: ActionHandler['userSlots']; configSchema: ActionHandler['configSchema'] }[] {
    return this.getAll().map((h) => ({
      type: h.type,
      label: h.label,
      userSlots: h.userSlots,
      configSchema: h.configSchema,
    }));
  }
}
