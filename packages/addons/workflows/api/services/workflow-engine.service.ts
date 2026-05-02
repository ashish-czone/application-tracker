import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';
import { DatabaseService, desc, eq } from '@packages/database';
import { RbacService } from '@packages/rbac';
import { evaluateConditionsInMemory, type Condition } from '@packages/common';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { workflowTransitionHistory } from '../schema/workflow-transition-history';
import { WorkflowRegistryService } from './workflow-registry.service';
import {
  type AvailableTransition,
  type TransitionPreflight,
  type ValidatedTransition,
  type RecordHistoryParams,
  type TransitionHistoryEntry,
  type ValidationResult,
} from '../types';

@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly registry: WorkflowRegistryService,
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

    if (transition.requiredPermissions.length > 0 && context?.actorId) {
      const missing = await this.findMissingPermissions(context.actorId, transition.requiredPermissions);
      if (missing.length > 0) {
        return { valid: false, transitionId: transition.id, missingPermissions: missing };
      }
    }

    return { valid: true, transitionId: transition.id };
  }

  /**
   * Dry-run a proposed transition: returns whether the transition is legal
   * in the workflow definition and which permissions the actor lacks. Does
   * NOT run guards — those are owned by per-entity services. UI flows that
   * need guard-aware previews call the per-entity service's previewTransition
   * (e.g. `GET /clients/:id/transition-preview`) and merge results client-side.
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
      missingPermissions = await this.findMissingPermissions(params.actorId, transition.requiredPermissions);
    }

    return {
      transitionId: transition.id,
      warnings: [],
      blockers: [],
      missingPermissions,
    };
  }

  /**
   * Validate a transition fully: legality, permissions, declarative
   * conditions evaluated against entity data, and (when supplied)
   * reason/comment requirements. Throws on failure. Returns transition
   * metadata on success.
   *
   * Reason/comment validation is opt-in: if the caller doesn't pass
   * `reason` / `comment`, the corresponding required-field checks are
   * skipped. This keeps the historical contract for callers that don't
   * surface the reason UX, while letting domain services that DO carry
   * a reason payload (e.g. compliance-rules `deprecate`) get the full
   * generic validation in one call instead of replicating it per entity.
   *
   * Does NOT run guards — those live in per-entity services and run before
   * the engine is called. Does NOT record history or emit events — the
   * caller wraps the entity update + history recording in a single
   * transaction, then emits after commit.
   */
  async validateAndThrow(params: {
    workflowSlug: string;
    entityType: string;
    entityId: string;
    fromState: string;
    toState: string;
    actorId: string | null;
    /** Optional reason. Required when the matched transition has `reasonRequired: true`. Validated against `reasonOptions` when present. */
    reason?: string;
    /** Optional comment. Required when the matched transition has `commentRequired: true`. */
    comment?: string;
    metadata?: Record<string, unknown>;
    entityData?: Record<string, unknown>;
  }): Promise<ValidatedTransition> {
    const definition = this.registry.getBySlug(params.workflowSlug);
    if (!definition) {
      throw new NotFoundException(`Workflow '${params.workflowSlug}' not found`);
    }

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
      throw new UnprocessableEntityException(
        `Transition from '${params.fromState}' to '${params.toState}' is not allowed in workflow '${params.workflowSlug}'`,
      );
    }

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

    // Reason/comment validation. Mirrors the messages historically used
    // by `EntityService.validateTransition` so consumers migrating off
    // the engine get identical error responses.
    if (matchedTransition) {
      if (matchedTransition.reasonRequired && !params.reason) {
        throw new BadRequestException('A reason is required for this transition');
      }
      if (matchedTransition.commentRequired && !params.comment) {
        throw new BadRequestException('A comment is required for this transition');
      }
      if (
        params.reason &&
        matchedTransition.reasonOptions &&
        matchedTransition.reasonOptions.length > 0 &&
        !matchedTransition.reasonOptions.includes(params.reason)
      ) {
        throw new BadRequestException(
          `Invalid reason. Must be one of: ${matchedTransition.reasonOptions.join(', ')}`,
        );
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
      .values(this.toHistoryInsertValues(params))
      .returning();

    return {
      historyId: historyRow.id,
      recordedAt: historyRow.createdAt.toISOString(),
    };
  }

  /**
   * Bulk variant of `recordHistory` for cascade paths that flip many
   * entities in one transaction (e.g. registration deactivation cancelling
   * every in-flight filing). One INSERT VALUES (…), preserving input order
   * in the returned IDs/timestamps.
   *
   * Empty input is a no-op — returns `[]` without touching the DB so callers
   * don't need a guard. Each row is built through the same
   * `withTenantInsert` path as `recordHistory`, so tenant scoping behaves
   * identically.
   */
  async recordHistoryBatch(
    rows: RecordHistoryParams[],
    tx: any,
  ): Promise<{ historyId: string; recordedAt: string }[]> {
    if (rows.length === 0) return [];

    const inserted = await tx
      .insert(workflowTransitionHistory)
      .values(rows.map((params) => this.toHistoryInsertValues(params)))
      .returning();

    return inserted.map((historyRow: { id: string; createdAt: Date }) => ({
      historyId: historyRow.id,
      recordedAt: historyRow.createdAt.toISOString(),
    }));
  }

  private toHistoryInsertValues(params: RecordHistoryParams) {
    return withTenantInsert(workflowTransitionHistory, {
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
    });
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

  /**
   * Returns the subset of `required` that the actor does not hold. Honors
   * the `*` wildcard the same way `RbacGuard` does — a holder of `*` passes
   * every permission check across the platform, including transition gates.
   * Without this, a Super Admin (whose role grants only `*`) would fail the
   * transition's `requiredPermissions` lookup because the map has no entry
   * for the named permission.
   */
  private async findMissingPermissions(actorId: string, required: string[]): Promise<string[]> {
    const userPermissions = await this.rbacService.getPermissionsForUser(actorId, 'admin');
    if ('*' in userPermissions) return [];
    return required.filter((p) => !userPermissions[p]);
  }
}
