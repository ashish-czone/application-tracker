import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { interpolateValues } from '../helpers/interpolate-values';
import type { ActionHandlerDef, ActionExecutionContext, ActionExecutionResult } from '../extensions/automations-extension.interface';
import type { EntityService } from '../entity.service';

@Injectable()
export class DeleteEntityAction implements ActionHandlerDef {
  readonly type = 'delete_entity';
  readonly label = 'Delete Entity';
  readonly userSlots: ActionHandlerDef['userSlots'] = [];
  readonly configSchema = {
    entityType: {
      type: 'string',
      required: false,
      label: 'Entity type (defaults to triggering entity)',
    },
    entityId: {
      type: 'string',
      required: false,
      label: 'Entity ID (supports {{mustache}}, defaults to triggering entity)',
    },
  };

  private readonly logger: ContextLogger;

  constructor(
    private readonly moduleRef: ModuleRef,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(DeleteEntityAction.name);
  }

  async execute(context: ActionExecutionContext): Promise<ActionExecutionResult> {
    const config = context.actionConfig.config as {
      entityType?: string;
      entityId?: string;
    };

    const templateContext = {
      event: context.event,
      payload: context.event?.payload ?? {},
    };

    const entityType = config.entityType ?? context.event?.entityType;
    const rawEntityId = config.entityId ?? context.event?.entityId;
    const entityId = rawEntityId
      ? (interpolateValues({ id: rawEntityId }, templateContext).id as string)
      : undefined;

    if (!entityType || !entityId) {
      this.logger.warn('No entity target available for delete_entity action');
      return {};
    }

    const entityService = this.getEntityService(entityType);
    if (!entityService) {
      this.logger.warn(`No entity service found for type "${entityType}"`);
      return {};
    }

    const actorId = context.event?.actorId ?? 'system';

    await entityService.softDelete(entityId, actorId);
    this.logger.debug('Entity deleted', { entityType, entityId, ruleId: context.rule.id });
    return { targetEntityType: entityType, targetEntityId: entityId };
  }

  async delete(targetEntityId: string, context: ActionExecutionContext): Promise<void> {
    const config = context.actionConfig.config as { entityType?: string };
    const entityType = config.entityType ?? context.event?.entityType;
    if (!entityType) return;

    const entityService = this.getEntityService(entityType);
    if (!entityService) return;

    const actorId = context.event?.actorId ?? 'system';
    await entityService.softDelete(targetEntityId, actorId);
  }

  private getEntityService(entityType: string): EntityService | null {
    try {
      return this.moduleRef.get<EntityService>(`ENTITY_SERVICE_${entityType}`, { strict: false });
    } catch {
      return null;
    }
  }
}
