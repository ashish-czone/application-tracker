import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { interpolateValues } from '@packages/automations';
import type { ActionHandler, ActionContext, ActionResult, UserSlotDefinition } from '@packages/automations';
import type { EntityService } from '../entity.service';

@Injectable()
export class UpdateEntityAction implements ActionHandler {
  readonly type = 'update_entity';
  readonly label = 'Update Entity';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {
    fields: {
      type: 'object',
      required: true,
      label: 'Field values to set (supports {{mustache}} interpolation)',
    },
  };

  private readonly logger: ContextLogger;

  constructor(
    private readonly moduleRef: ModuleRef,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(UpdateEntityAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const { fields } = context.actionConfig.config as { fields?: Record<string, unknown> };
    if (!fields || Object.keys(fields).length === 0) {
      this.logger.warn(`No fields configured for update_entity action in rule ${context.rule.id}`);
      return {};
    }

    const entityType = context.event?.entityType;
    const entityId = context.event?.entityId;
    if (!entityType || !entityId) {
      this.logger.warn('No entity context available for update_entity action');
      return {};
    }

    const entityService = this.getEntityService(entityType);
    if (!entityService) {
      this.logger.warn(`No entity service found for type "${entityType}"`);
      return {};
    }

    const templateContext = {
      event: context.event,
      payload: context.event?.payload ?? {},
    };
    const resolvedFields = interpolateValues(fields, templateContext);
    const actorId = context.event?.actorId ?? 'system';

    await entityService.update(entityId, resolvedFields, actorId);
    this.logger.debug('Entity updated', { entityType, entityId, fields: Object.keys(resolvedFields), ruleId: context.rule.id });
    return {};
  }

  async update(targetEntityId: string, set: Record<string, unknown>, context: ActionContext): Promise<void> {
    const entityType = context.event?.entityType;
    if (!entityType) return;

    const entityService = this.getEntityService(entityType);
    if (!entityService) return;

    const actorId = context.event?.actorId ?? 'system';
    await entityService.update(targetEntityId, set, actorId);
  }

  private getEntityService(entityType: string): EntityService | null {
    try {
      return this.moduleRef.get<EntityService>(`ENTITY_SERVICE_${entityType}`, { strict: false });
    } catch {
      return null;
    }
  }
}
