import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { interpolateValues } from '@packages/automations';
import type { ActionHandler, ActionContext, ActionResult, UserSlotDefinition } from '@packages/automations';
import type { EntityService } from '../entity.service';

@Injectable()
export class CreateEntityAction implements ActionHandler {
  readonly type = 'create_entity';
  readonly label = 'Create Entity';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {
    entityType: {
      type: 'string',
      required: true,
      label: 'Entity type to create (e.g. tasks, candidates)',
    },
    fields: {
      type: 'object',
      required: true,
      label: 'Field values for the new entity (supports {{mustache}} interpolation)',
    },
  };

  private readonly logger: ContextLogger;

  constructor(
    private readonly moduleRef: ModuleRef,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(CreateEntityAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const config = context.actionConfig.config as {
      entityType?: string;
      fields?: Record<string, unknown>;
    };

    if (!config.entityType) {
      this.logger.warn(`No entityType configured for create_entity action in rule ${context.rule.id}`);
      return {};
    }

    const { fields } = config;
    if (!fields || Object.keys(fields).length === 0) {
      this.logger.warn(`No fields configured for create_entity action in rule ${context.rule.id}`);
      return {};
    }

    const entityService = this.getEntityService(config.entityType);
    if (!entityService) {
      this.logger.warn(`No entity service found for type "${config.entityType}"`);
      return {};
    }

    const templateContext = {
      event: context.event,
      payload: context.event?.payload ?? {},
    };
    const resolvedFields = interpolateValues(fields, templateContext);
    const actorId = context.event?.actorId ?? 'system';

    const created = await entityService.create(resolvedFields, actorId);
    this.logger.debug('Entity created', {
      entityType: config.entityType,
      entityId: created.id,
      ruleId: context.rule.id,
    });

    return { targetEntityId: created.id as string };
  }

  private getEntityService(entityType: string): EntityService | null {
    try {
      return this.moduleRef.get<EntityService>(`ENTITY_SERVICE_${entityType}`, { strict: false });
    } catch {
      return null;
    }
  }
}
