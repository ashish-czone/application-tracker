import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq, inArray, not } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { WorkflowEngineService, WorkflowRegistryService } from '@packages/workflows';
import type { TransitionHookContext } from '@packages/entity-engine';
import { AppLoggerService, type ContextLogger } from '@packages/logger';

import { complianceFilings } from '../schema/compliance-filings';
import { COMPLIANCE_CLIENT_DORMANTISED } from '../events/types';

/**
 * Q6 — when a client moves from `active` to `dormant`, every non-terminal
 * compliance filing for that client is auto-cancelled inside the client
 * transition tx. The admin's dormancy reason/comment travel through to each
 * filing's workflow_history row so every filing's audit trail stands on its
 * own ("Cancelled: Client dormantised — <admin-supplied reason>") without
 * needing a duplicate column on `compliance_filings`.
 */
const TERMINAL_FILING_STATUSES = ['completed', 'cancelled'];
const FILING_WORKFLOW_SLUG = 'compliance-filing-status';

@Injectable()
export class ClientDormancyService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
    private readonly events: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ClientDormancyService.name);
  }

  /**
   * Called from the CLIENTS onTransition hook. Operates entirely inside the
   * shared tx so bulk cancellation commits atomically with the client's
   * status flip — an exception here rolls the whole dormancy back.
   */
  async onClientDormantised(ctx: TransitionHookContext, tx: any): Promise<void> {
    if (ctx.fieldKey !== 'status' || ctx.toState !== 'dormant') return;
    if (ctx.fromState !== 'active') return;

    const clientId = ctx.entityId;
    const clientName = (ctx.entity.name as string | null | undefined) ?? clientId;

    const filings = await tx
      .select({ id: complianceFilings.id, status: complianceFilings.status })
      .from(complianceFilings)
      .where(and(
        eq(complianceFilings.clientId, clientId),
        not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
      ));

    if (filings.length === 0) {
      this.logger.log('Client dormantised — no non-terminal filings to cancel', { clientId });
      this.emitCascadeEvent(ctx, clientName, []);
      return;
    }

    const cancelledIds = filings.map((f: { id: string }) => f.id);

    await tx
      .update(complianceFilings)
      .set({ status: 'cancelled' })
      .where(inArray(complianceFilings.id, cancelledIds));

    const definition = this.workflowRegistry.getBySlug(FILING_WORKFLOW_SLUG);
    if (!definition) {
      throw new Error(`Workflow definition '${FILING_WORKFLOW_SLUG}' not found — cannot record filing cancellation history`);
    }

    // Look up transitionId per fromState → 'cancelled'. Leaving `null` is
    // acceptable per workflow_transition_history schema, but recording the
    // right transitionId keeps the audit trail precise when the configured
    // transition has permissions / reasons attached to it.
    const transitionIdByFromState = new Map<string, string>();
    for (const t of definition.transitions) {
      if (t.toStateName === 'cancelled') {
        transitionIdByFromState.set(t.fromStateName, t.id);
      }
    }

    const historyReason = 'Client dormantised';
    const historyComment = ctx.comment
      ? `Auto-cancelled: client "${clientName}" dormantised. ${ctx.comment}`
      : `Auto-cancelled: client "${clientName}" dormantised.`;

    for (const filing of filings as Array<{ id: string; status: string }>) {
      const transitionId = transitionIdByFromState.get(filing.status);
      if (!transitionId) {
        throw new Error(
          `No configured transition from '${filing.status}' → 'cancelled' on workflow '${FILING_WORKFLOW_SLUG}'. Filing ${filing.id} cannot be auto-cancelled; fix the workflow definition or exclude this state from the dormancy cascade.`,
        );
      }
      await this.workflowEngine.recordHistory({
        workflowDefinitionId: definition.id,
        entityType: 'compliance-filings',
        entityId: filing.id,
        fieldName: 'status',
        fromState: filing.status,
        toState: 'cancelled',
        transitionId,
        actorId: ctx.actorId,
        reason: historyReason,
        comment: historyComment,
      }, tx);
    }

    this.logger.log('Client dormantised — cancelled non-terminal filings', {
      clientId,
      cancelledCount: cancelledIds.length,
    });

    this.emitCascadeEvent(ctx, clientName, cancelledIds);
  }

  private emitCascadeEvent(
    ctx: TransitionHookContext,
    clientName: string,
    cancelledFilingIds: string[],
  ): void {
    this.events.emitDynamic(COMPLIANCE_CLIENT_DORMANTISED, {
      entityType: 'clients',
      entityId: ctx.entityId,
      actorId: ctx.actorId,
      payload: {
        clientId: ctx.entityId,
        clientName,
        reason: ctx.reason ?? null,
        comment: ctx.comment ?? null,
        cancelledFilingIds,
      },
    });
  }
}
