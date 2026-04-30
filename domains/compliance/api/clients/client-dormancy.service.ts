import { Injectable } from '@nestjs/common';
import { DatabaseService, count, eq, inArray, not, sql, withScope } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { WorkflowEngineService, WorkflowRegistryService } from '@packages/workflows';
import type { TransitionContext } from '@packages/entity-engine';
import { AppLoggerService, type ContextLogger } from '@packages/logger';

import { complianceFilings } from '../schema/compliance-filings';
import { COMPLIANCE_CLIENT_DORMANTISED } from '../events/types';

/**
 * Q6 — when a client moves from `active` to `dormant`, every non-terminal
 * compliance filing for that client is auto-cancelled inside the same
 * transaction that flips the client's status. The admin's dormancy reason
 * and comment travel through to each filing's workflow_history row so every
 * filing's audit trail stands on its own ("Cancelled: Client dormantised —
 * <admin-supplied reason>") without needing a duplicate column on
 * `compliance_filings`.
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
   * Count of non-terminal filings that would be cancelled if this client
   * were dormantised right now. Used by the `compliance-client-dormancy-warning`
   * advisory guard to populate the UI preflight banner — so the admin
   * confirms knowingly. Reads via the shared DB handle (not a tx) because
   * preflight is called from the HTTP layer outside any transition.
   */
  async countNonTerminalFilings(clientId: string): Promise<number> {
    const [row] = await this.database.db
      .select({ count: count() })
      .from(complianceFilings)
      .where(withScope(
        complianceFilings,
        eq(complianceFilings.clientId, clientId),
        not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
      ));
    return Number(row?.count ?? 0);
  }

  /**
   * Cancel every non-terminal filing for the dormantised client on the
   * caller-supplied tx. Called by `ClientsService.transition` from inside
   * the same tx that flips the client's status, so the cascade commits
   * atomically with the status flip — an exception here rolls the whole
   * transition back.
   *
   * Caller is responsible for (a) gating this on the right transition
   * (active → dormant on the `status` field) and (b) calling
   * `emitCascadeEvent` with the returned IDs after the tx commits.
   */
  async cancelInFlightFilings(
    ctx: TransitionContext,
    tx: any,
  ): Promise<{ cancelledFilingIds: string[] }> {
    const clientId = ctx.entityId;
    const clientName = (ctx.entity.name as string | null | undefined) ?? clientId;

    const filings = await tx
      .select({ id: complianceFilings.id, status: complianceFilings.status })
      .from(complianceFilings)
      .where(withScope(
        complianceFilings,
        eq(complianceFilings.clientId, clientId),
        not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
      ));

    if (filings.length === 0) {
      this.logger.log('Client dormantised — no non-terminal filings to cancel', { clientId });
      return { cancelledFilingIds: [] };
    }

    const cancelledIds = filings.map((f: { id: string }) => f.id);

    await tx
      .update(complianceFilings)
      .set({ status: 'cancelled' })
      .where(withScope(complianceFilings, inArray(complianceFilings.id, cancelledIds)));

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

    const historyRows = (filings as Array<{ id: string; status: string }>).map((filing) => {
      const transitionId = transitionIdByFromState.get(filing.status);
      if (!transitionId) {
        throw new Error(
          `No configured transition from '${filing.status}' → 'cancelled' on workflow '${FILING_WORKFLOW_SLUG}'. Filing ${filing.id} cannot be auto-cancelled; fix the workflow definition or exclude this state from the dormancy cascade.`,
        );
      }
      return {
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
      };
    });

    await this.workflowEngine.recordHistoryBatch(historyRows, tx);

    this.logger.log('Client dormantised — cancelled non-terminal filings', {
      clientId,
      cancelledCount: cancelledIds.length,
    });

    return { cancelledFilingIds: cancelledIds };
  }

  /**
   * Post-commit settle pass that catches filings INSERTed by an event-driven
   * generator (J3 / J4 / J5) whose tx interleaved with the dormancy tx.
   *
   * The race: while the dormancy tx is open it has flipped clients.status to
   * 'dormant' but not committed. `cancelInFlightFilings` SELECTs the current
   * non-terminal filing set under that tx. Any J4 listener reading
   * `clients.status` from a different connection still sees 'active' (READ
   * COMMITTED hides our uncommitted UPDATE), passes its own per-occurrence
   * `isClientActive` guard, and INSERTs a new filing. If that INSERT commits
   * AFTER our cascade SELECT but BEFORE our cascade UPDATE COMMIT, the
   * UPDATE misses it — the filing survives as 'pending' under a now-dormant
   * client.
   *
   * This sweep runs after the dormancy tx commits (so 'dormant' is visible
   * everywhere). It re-queries for non-terminal filings, cancels any it
   * finds, then briefly settles before retrying — the settle window lets a
   * still-iterating generator observe the committed status and abort via
   * its per-occurrence `isClientActive` guard. Stops as soon as a sweep
   * round finds nothing, or after `maxAttempts` so we don't spin
   * indefinitely on a pathological generator loop.
   *
   * Caveats: cancellations done here bypass the workflow engine — a direct
   * UPDATE on `compliance_filings.status` so the sweep stays cheap and
   * never raises a workflow guard error mid-loop. The audit trail for the
   * straggler filings shows them flipping straight to 'cancelled' without
   * a workflow_transition_history row; the dormantisation event itself
   * carries the user-supplied reason and is the authoritative record of
   * "why these are cancelled".
   */
  async sweepLateFilings(
    clientId: string,
    options: { maxAttempts?: number; settleDelayMs?: number } = {},
  ): Promise<{ cancelledFilingIds: string[] }> {
    const maxAttempts = options.maxAttempts ?? 5;
    const settleDelayMs = options.settleDelayMs ?? 50;
    const cancelled: string[] = [];

    // Sleep at the start of every iteration (including the first). The
    // straggler we are racing against is a J4 generator whose INSERT
    // statement issued before our cascade SELECT but whose tx has not yet
    // committed when the cascade's outer tx commits — a 0-row first SELECT
    // here would simply mean that tx is still open and we'd exit early. The
    // settle window lets it land before we look. Subsequent iterations also
    // sleep so a fresh straggler created during our UPDATE has time to
    // commit and be picked up by the next pass; we only break once an
    // iteration finds nothing AFTER waiting.
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, settleDelayMs));

      const rows = await this.database.db
        .select({ id: complianceFilings.id })
        .from(complianceFilings)
        .where(withScope(
          complianceFilings,
          eq(complianceFilings.clientId, clientId),
          not(inArray(complianceFilings.status, TERMINAL_FILING_STATUSES)),
        ));

      if (rows.length === 0) break;

      const ids = rows.map((r: { id: string }) => r.id);
      await this.database.db
        .update(complianceFilings)
        .set({ status: sql`'cancelled'` })
        .where(withScope(complianceFilings, inArray(complianceFilings.id, ids)));
      cancelled.push(...ids);
    }

    if (cancelled.length > 0) {
      this.logger.log('Client dormantised — late filing sweep cancelled stragglers', {
        clientId,
        cancelledCount: cancelled.length,
      });
    }

    return { cancelledFilingIds: cancelled };
  }

  /**
   * Post-commit emission of the cascade event. Called by
   * `ClientsService.transition` after the dormancy tx commits. Fires exactly
   * once per dormantisation — empty cancelledFilingIds still emits so
   * listeners see that the dormantisation itself happened.
   */
  emitCascadeEvent(ctx: TransitionContext, cancelledFilingIds: string[]): void {
    const clientName = (ctx.entity.name as string | null | undefined) ?? ctx.entityId;
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
