import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { WorkflowEngineService } from '@packages/workflows';
import type { ActionHandler, ActionContext, ActionResult, UserSlotDefinition } from '@packages/automations';
import type { EntityService } from '../entity.service';
import { EntityRegistryService } from '../entity-registry.service';

@Injectable()
export class TransitionWorkflowAction implements ActionHandler {
  readonly type = 'transition_workflow';
  readonly label = 'Transition Workflow';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {
    workflowSlug: { type: 'string', required: true, label: 'Workflow' },
    targetState: { type: 'string', required: true, label: 'Target State' },
  };

  private readonly logger: ContextLogger;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly entityRegistry: EntityRegistryService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(TransitionWorkflowAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const { workflowSlug, targetState } = context.actionConfig.config as {
      workflowSlug?: string;
      targetState?: string;
    };

    if (!workflowSlug || !targetState) {
      this.logger.warn(`Missing workflowSlug or targetState in rule ${context.rule.id}`);
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

    // Find the workflow field key on this entity
    const entityConfig = this.entityRegistry.get(entityType);
    if (!entityConfig) {
      this.logger.warn(`Entity config not found for type "${entityType}"`);
      return {};
    }

    const workflowFieldKey = Object.entries(entityConfig.fieldMeta).find(
      ([, meta]) => meta.fieldType === 'workflow' && meta.workflow?.slug === workflowSlug,
    )?.[0];

    if (!workflowFieldKey) {
      this.logger.warn(`No workflow field with slug "${workflowSlug}" found on entity "${entityType}"`);
      return {};
    }

    const actorId = context.event?.actorId ?? 'system';

    // Validate the transition (checks permissions, guards, conditions)
    const validated = await this.workflowEngine.validateAndThrow({
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

    // The entity service's update method handles workflow field updates
    // by detecting workflow fields and calling recordHistory internally
    await entityService.update(entityId, { [workflowFieldKey]: targetState }, actorId);

    this.logger.debug('Workflow transitioned', {
      entityType, entityId, workflowSlug,
      from: currentState, to: targetState,
      ruleId: context.rule.id,
    });

    return {};
  }

  private getEntityService(entityType: string): EntityService | null {
    try {
      return this.moduleRef.get<EntityService>(`ENTITY_SERVICE_${entityType}`, { strict: false });
    } catch {
      return null;
    }
  }
}
