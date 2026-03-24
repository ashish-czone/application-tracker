import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { DatabaseService, desc, eq, and } from '@packages/database';
import { RbacService } from '@packages/rbac';
import { evaluateConditionsInMemory, type Condition } from '@packages/notifications';
import { workflowTransitionHistory } from '../schema/workflow-transition-history';
import { WorkflowRegistryService } from './workflow-registry.service';
import { WorkflowGuardRegistry } from './workflow-guard-registry.service';
import {
  type AvailableTransition,
  type ValidatedTransition,
  type RecordHistoryParams,
  type TransitionHistoryEntry,
  type ValidationResult,
  type WorkflowGuardContext,
  type WorkflowGuardFn,
} from '../types';

@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly registry: WorkflowRegistryService,
    private readonly guardRegistry: WorkflowGuardRegistry,
    private readonly database: DatabaseService,
    private readonly rbacService: RbacService,
  ) {}

  getAvailableTransitions(workflowSlug: string, currentState: string): AvailableTransition[] {
    const definition = this.registry.getBySlug(workflowSlug);
    if (!definition) {
      throw new NotFoundException(`Workflow '${workflowSlug}' not found`);
    }

    const transitions = definition.transitions
      .filter((t) => t.fromStateName === currentState)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return transitions.map((t) => {
      const toState = definition.states.find((s) => s.name === t.toStateName);
      return {
        transitionId: t.id,
        transitionName: t.name,
        toState: t.toStateName,
        toStateLabel: toState?.label ?? t.toStateName,
        toStateColor: toState?.color ?? null,
        requiredPermissions: t.requiredPermissions,
      };
    });
  }

  async validateTransition(
    workflowSlug: string,
    fromState: string,
    toState: string,
    context?: { entityId: string; entityType: string; actorId: string | null; metadata?: Record<string, unknown> },
  ): Promise<ValidationResult> {
    const definition = this.registry.getBySlug(workflowSlug);
    if (!definition) {
      throw new NotFoundException(`Workflow '${workflowSlug}' not found`);
    }

    const transition = definition.transitions.find(
      (t) => t.fromStateName === fromState && t.toStateName === toState,
    );

    if (!transition) {
      return { valid: false };
    }

    // Check required permissions via RBAC
    if (transition.requiredPermissions.length > 0 && context?.actorId) {
      const userPermissions = await this.rbacService.getPermissionsForUser(context.actorId, 'admin');
      const missing = transition.requiredPermissions.filter((p) => !userPermissions[p]);
      if (missing.length > 0) {
        return { valid: false, transitionId: transition.id, missingPermissions: missing };
      }
    }

    // Execute guards
    if (transition.guardNames.length > 0 && context) {
      const guardContext: WorkflowGuardContext = {
        workflowSlug,
        entityType: context.entityType,
        entityId: context.entityId,
        fieldName: definition.fieldName,
        fromState,
        toState,
        actorId: context.actorId,
        metadata: context.metadata,
      };

      const guardResult = await this.guardRegistry.executeGuards(transition.guardNames, guardContext);
      if (!guardResult.passed) {
        return { valid: false, transitionId: transition.id, failedGuard: guardResult.failedGuard };
      }
    }

    return { valid: true, transitionId: transition.id };
  }

  /**
   * Validate a transition fully (permissions, guards, conditions, inline guards).
   * Throws on failure. Returns transition metadata on success.
   *
   * Does NOT record history or emit events — the caller is responsible for
   * wrapping the entity update + history recording in a single transaction,
   * then emitting the event after the transaction commits.
   */
  async validateAndThrow(params: {
    workflowSlug: string;
    entityType: string;
    entityId: string;
    fromState: string;
    toState: string;
    actorId: string | null;
    metadata?: Record<string, unknown>;
    entityData?: Record<string, unknown>;
    additionalGuards?: WorkflowGuardFn[];
  }): Promise<ValidatedTransition> {
    const definition = this.registry.getBySlug(params.workflowSlug);
    if (!definition) {
      throw new NotFoundException(`Workflow '${params.workflowSlug}' not found`);
    }

    // Validate the transition (permissions + guards)
    const validation = await this.validateTransition(
      params.workflowSlug,
      params.fromState,
      params.toState,
      {
        entityId: params.entityId,
        entityType: params.entityType,
        actorId: params.actorId,
        metadata: params.metadata,
      },
    );

    if (!validation.valid) {
      if (validation.missingPermissions) {
        throw new ForbiddenException(
          `Missing permissions: ${validation.missingPermissions.join(', ')}`,
        );
      }
      if (validation.failedGuard) {
        throw new UnprocessableEntityException(
          `Guard '${validation.failedGuard}' rejected the transition`,
        );
      }
      throw new UnprocessableEntityException(
        `Transition from '${params.fromState}' to '${params.toState}' is not allowed in workflow '${params.workflowSlug}'`,
      );
    }

    // Evaluate declarative conditions from transition metadata
    const matchedTransition = definition.transitions.find(
      (t) => t.fromStateName === params.fromState && t.toStateName === params.toState,
    );
    if (matchedTransition?.metadata && params.entityData) {
      const conditions = (matchedTransition.metadata as Record<string, unknown>).conditions as Condition[] | undefined;
      if (conditions && conditions.length > 0) {
        const conditionsPassed = evaluateConditionsInMemory(conditions, params.entityData);
        if (!conditionsPassed) {
          throw new UnprocessableEntityException(
            `Conditions not met for transition from '${params.fromState}' to '${params.toState}'`,
          );
        }
      }
    }

    // Execute additional inline guards
    if (params.additionalGuards && params.additionalGuards.length > 0) {
      const guardContext: WorkflowGuardContext = {
        workflowSlug: params.workflowSlug,
        entityType: params.entityType,
        entityId: params.entityId,
        fieldName: definition.fieldName,
        fromState: params.fromState,
        toState: params.toState,
        actorId: params.actorId,
        metadata: params.metadata,
      };

      for (const guard of params.additionalGuards) {
        const result = await guard(guardContext);
        if (!result) {
          throw new UnprocessableEntityException(
            'An additional guard rejected the transition',
          );
        }
      }
    }

    const transition = definition.transitions.find((t) => t.id === validation.transitionId);

    return {
      transitionId: validation.transitionId!,
      transitionName: transition?.name ?? '',
      workflowDefinitionId: definition.id,
      workflowName: definition.name,
      fieldName: definition.fieldName,
    };
  }

  /**
   * Record a transition in the history table.
   * Call this inside the same transaction that updates the entity field.
   */
  async recordHistory(params: RecordHistoryParams, tx: any): Promise<{ historyId: string; recordedAt: string }> {
    const [historyRow] = await tx
      .insert(workflowTransitionHistory)
      .values({
        workflowDefinitionId: params.workflowDefinitionId,
        entityType: params.entityType,
        entityId: params.entityId,
        fieldName: params.fieldName,
        fromState: params.fromState,
        toState: params.toState,
        transitionId: params.transitionId,
        actorId: params.actorId,
        comment: params.comment,
        metadata: params.metadata,
      })
      .returning();

    return {
      historyId: historyRow.id,
      recordedAt: historyRow.createdAt.toISOString(),
    };
  }

  async getHistory(
    entityType: string,
    entityId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<TransitionHistoryEntry[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const rows = await this.database.db
      .select()
      .from(workflowTransitionHistory)
      .where(
        and(
          eq(workflowTransitionHistory.entityType, entityType),
          eq(workflowTransitionHistory.entityId, entityId),
        ),
      )
      .orderBy(desc(workflowTransitionHistory.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      workflowDefinitionId: r.workflowDefinitionId,
      entityType: r.entityType,
      entityId: r.entityId,
      fieldName: r.fieldName,
      fromState: r.fromState,
      toState: r.toState,
      transitionId: r.transitionId,
      actorId: r.actorId,
      comment: r.comment,
      metadata: r.metadata as Record<string, unknown> | null,
      createdAt: r.createdAt,
    }));
  }

  async getEntityState(
    workflowSlug: string,
    entityType: string,
    entityId: string,
  ): Promise<string | null> {
    const definition = this.registry.getBySlug(workflowSlug);
    if (!definition) {
      throw new NotFoundException(`Workflow '${workflowSlug}' not found`);
    }

    const [latest] = await this.database.db
      .select({ toState: workflowTransitionHistory.toState })
      .from(workflowTransitionHistory)
      .where(
        and(
          eq(workflowTransitionHistory.workflowDefinitionId, definition.id),
          eq(workflowTransitionHistory.entityType, entityType),
          eq(workflowTransitionHistory.entityId, entityId),
        ),
      )
      .orderBy(desc(workflowTransitionHistory.createdAt))
      .limit(1);

    return latest?.toState ?? null;
  }
}
