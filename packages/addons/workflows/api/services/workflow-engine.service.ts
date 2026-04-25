import { Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { DatabaseService, desc, eq, and } from '@packages/database';
import { RbacService } from '@packages/rbac';
import { evaluateConditionsInMemory, type Condition } from '@packages/common';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { workflowTransitionHistory } from '../schema/workflow-transition-history';
import { WorkflowRegistryService } from './workflow-registry.service';
import { WorkflowGuardRegistry } from './workflow-guard-registry.service';
import {
  type AvailableTransition,
  type TransitionPreflight,
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
        reasonOptions: t.reasonOptions,
        reasonRequired: t.reasonRequired,
        commentRequired: t.commentRequired,
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

    // Execute guards. Warnings do not block the transition — only the UI
    // preflight surfaces them. Blockers short-circuit the commit path with
    // the guard's own message.
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

      const { blockers } = await this.guardRegistry.runGuards(transition.guardNames, guardContext);
      if (blockers.length > 0) {
        return {
          valid: false,
          transitionId: transition.id,
          failedGuard: blockers[0].guardName,
          blockerMessage: blockers[0].message,
        };
      }
    }

    return { valid: true, transitionId: transition.id };
  }

  /**
   * Dry-run a proposed transition for the UI confirm dialog. Returns every
   * warning and blocker (including missing permissions) without touching the
   * database. Guards that throw at this stage bubble up as 500s — preflight
   * is not a try/catch layer. Each caller already rechecks on the commit
   * path via validateAndThrow(), so preflight is advisory-only.
   */
  async preflightTransition(params: {
    workflowSlug: string;
    entityType: string;
    entityId: string;
    fromState: string;
    toState: string;
    actorId: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<TransitionPreflight> {
    const definition = this.registry.getBySlug(params.workflowSlug);
    if (!definition) {
      throw new NotFoundException(`Workflow '${params.workflowSlug}' not found`);
    }

    const transition = definition.transitions.find(
      (t) => t.fromStateName === params.fromState && t.toStateName === params.toState,
    );
    if (!transition) {
      return {
        transitionId: null,
        warnings: [],
        blockers: [`Transition from '${params.fromState}' to '${params.toState}' is not allowed in workflow '${params.workflowSlug}'`],
        missingPermissions: [],
      };
    }

    let missingPermissions: string[] = [];
    if (transition.requiredPermissions.length > 0 && params.actorId) {
      const userPermissions = await this.rbacService.getPermissionsForUser(params.actorId, 'admin');
      missingPermissions = transition.requiredPermissions.filter((p) => !userPermissions[p]);
    }

    let warnings: string[] = [];
    let guardBlockers: string[] = [];
    if (transition.guardNames.length > 0) {
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
      const result = await this.guardRegistry.runGuards(transition.guardNames, guardContext);
      warnings = result.warnings;
      guardBlockers = result.blockers.map((b) => b.message);
    }

    return {
      transitionId: transition.id,
      warnings,
      blockers: guardBlockers,
      missingPermissions,
    };
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
          validation.blockerMessage ?? `Guard '${validation.failedGuard}' rejected the transition`,
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
        if (result.decision === 'block') {
          throw new UnprocessableEntityException(result.message);
        }
        // Inline additional guards cannot warn — only named registry guards
        // surface in the UI preflight. Treat allow_with_warning as allow.
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
      .values(withTenantInsert(workflowTransitionHistory, {
        workflowDefinitionId: params.workflowDefinitionId,
        entityType: params.entityType,
        entityId: params.entityId,
        fieldName: params.fieldName,
        fromState: params.fromState,
        toState: params.toState,
        transitionId: params.transitionId,
        actorId: params.actorId,
        reason: params.reason,
        comment: params.comment,
        metadata: params.metadata,
      }))
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
        withTenant(
          workflowTransitionHistory,
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
      reason: r.reason,
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
        withTenant(
          workflowTransitionHistory,
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
