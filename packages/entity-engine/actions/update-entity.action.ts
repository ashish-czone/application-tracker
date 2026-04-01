import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { interpolateValues } from '@packages/automations';
import { coerceFieldValues } from '@packages/common';
import type { ActionHandler, ActionContext, ActionResult, UserSlotDefinition } from '@packages/automations';
import type { EntityService } from '../entity.service';
import { FieldDefinitionService } from '../services/field-definition.service';

@Injectable()
export class UpdateEntityAction implements ActionHandler {
  readonly type = 'update_entity';
  readonly label = 'Update Entity';
  readonly userSlots: UserSlotDefinition[] = [];
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
    fields: {
      type: 'object',
      required: true,
      label: 'Field values to set (supports {{mustache}} interpolation)',
    },
  };

  private readonly logger: ContextLogger;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly fieldDefService: FieldDefinitionService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(UpdateEntityAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const config = context.actionConfig.config as {
      entityType?: string;
      entityId?: string;
      fields?: Record<string, unknown>;
    };

    const { fields } = config;
    if (!fields || Object.keys(fields).length === 0) {
      this.logger.warn(`No fields configured for update_entity action in rule ${context.rule.id}`);
      return {};
    }

    const templateContext = {
      event: context.event,
      payload: context.event?.payload ?? {},
    };

    // Resolve target entity — config overrides take priority, fall back to triggering entity
    const entityType = config.entityType ?? context.event?.entityType;
    const rawEntityId = config.entityId ?? context.event?.entityId;
    const entityId = rawEntityId ? interpolateValues({ id: rawEntityId }, templateContext).id as string : undefined;

    if (!entityType || !entityId) {
      this.logger.warn('No entity target available for update_entity action');
      return {};
    }

    const entityService = this.getEntityService(entityType);
    if (!entityService) {
      this.logger.warn(`No entity service found for type "${entityType}"`);
      return {};
    }

    const resolvedFields = interpolateValues(fields, templateContext);

    // Coerce interpolated string values to match target field types
    const fieldDefs = await this.fieldDefService.listByEntity(entityType);
    const fieldTypeMap = Object.fromEntries(fieldDefs.map((d) => [d.fieldKey, d.fieldType]));
    const coercedFields = coerceFieldValues(resolvedFields, fieldTypeMap);

    const actorId = context.event?.actorId ?? 'system';

    await entityService.update(entityId, coercedFields, actorId);
    this.logger.debug('Entity updated', { entityType, entityId, fields: Object.keys(resolvedFields), ruleId: context.rule.id });
    return {};
  }

  async update(targetEntityId: string, set: Record<string, unknown>, context: ActionContext): Promise<void> {
    const config = context.actionConfig.config as { entityType?: string };
    const entityType = config.entityType ?? context.event?.entityType;
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
