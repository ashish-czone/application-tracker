import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { ActionHandler, ActionContext, ActionResult, UserSlotDefinition } from '@packages/automations';
import { WorkflowEngineService } from './workflow-engine.service';

/** Minimal interface for EntityService — avoids compile-time dependency on entity-engine */
interface EntityServiceLike {
  update(id: string, data: Record<string, unknown>, actorId: string): Promise<unknown>;
}

@Injectable()
export class TransitionWorkflowAction implements ActionHandler {
  readonly type = 'transition_workflow';
  readonly label = 'Transition Workflow';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {
    workflowSlug: { type: 'string', required: true, label: 'Workflow' },
    fieldKey: { type: 'string', required: true, label: 'Workflow field key on the entity' },
    targetState: { type: 'string', required: true, label: 'Target State' },
  };

  private readonly logger: ContextLogger;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly workflowEngine: WorkflowEngineService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(TransitionWorkflowAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const { workflowSlug, fieldKey, targetState } = context.actionConfig.config as {
      workflowSlug?: string;
      fieldKey?: string;
      targetState?: string;
    };

    if (!workflowSlug || !fieldKey || !targetState) {
      this.logger.warn(`Missing workflowSlug, fieldKey, or targetState in rule ${context.rule.id}`);
      return {};
    }

    const entityType = context.event?.entityType;
    const entityId = context.event?.entityId;
    if (!entityType || !entityId) {
      this.logger.warn('No entity context available for transition_workflow action');
      return {};
    }

    // Get current workflow state
    const currentState = await this.workflowEngine.getEntityState(workflowSlug, entityType, entityId);
    if (!currentState) {
      this.logger.warn(`No workflow state found for ${entityType}/${entityId} on workflow ${workflowSlug}`);
      return {};
    }

    if (currentState === targetState) {
      this.logger.debug('Entity already in target state — skipping', { entityType, entityId, targetState });
      return {};
    }

    const actorId = context.event?.actorId ?? 'system';

    // Validate the transition (checks permissions, guards, conditions)
    await this.workflowEngine.validateAndThrow({
      workflowSlug,
      entityType,
      entityId,
      fromState: currentState,
      toState: targetState,
      actorId,
      entityData: context.event?.payload?.after as Record<string, unknown> | undefined,
    });

    // Perform the update via entity service to trigger all hooks and events
    const entityService = this.getEntityService(entityType);
    if (!entityService) {
      this.logger.warn(`No entity service found for type "${entityType}"`);
      return {};
    }

    await entityService.update(entityId, { [fieldKey]: targetState }, actorId);

    this.logger.debug('Workflow transitioned', {
      entityType, entityId, workflowSlug,
      from: currentState, to: targetState,
      ruleId: context.rule.id,
    });

    return {};
  }

  private getEntityService(entityType: string): EntityServiceLike | null {
    try {
      return this.moduleRef.get<EntityServiceLike>(`ENTITY_SERVICE_${entityType}`, { strict: false });
    } catch {
      return null;
    }
  }
}
