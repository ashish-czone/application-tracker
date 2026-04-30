import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientDormancyService } from '../client-dormancy.service';
import type { TransitionContext } from '@packages/entity-engine';
import type { AppLoggerService } from '@packages/logger';

/**
 * Unit tests for the dormancy cascade — the most intricate compliance code
 * path. cancelInFlightFilings runs inside a tx and must:
 *   - select non-terminal filings
 *   - update them to cancelled
 *   - record one workflow_transition_history row per cancelled filing,
 *     with the right transitionId resolved from the workflow definition
 *
 * sweepLateFilings is the post-commit race-guard for filings inserted by an
 * event-driven generator whose tx interleaved with the dormancy tx.
 *
 * Reference for the audit-coverage gap: project_compliance_audit_phase3.md
 * test-coverage HIGH #1.
 */

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockTxSelectReturning(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockTxUpdate() {
  const chain: AnyChain = {} as AnyChain;
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

const filingWorkflowDefinition = {
  id: 'wf-def-filing-status',
  transitions: [
    { id: 't-pending-cancelled', fromStateName: 'pending', toStateName: 'cancelled' },
    { id: 't-in_progress-cancelled', fromStateName: 'in_progress', toStateName: 'cancelled' },
    { id: 't-review-cancelled', fromStateName: 'review', toStateName: 'cancelled' },
    { id: 't-rejected-cancelled', fromStateName: 'rejected', toStateName: 'cancelled' },
    // Some unrelated transition the cascade should ignore
    { id: 't-pending-in_progress', fromStateName: 'pending', toStateName: 'in_progress' },
  ],
};

function makeCtx(overrides: Partial<TransitionContext> = {}): TransitionContext {
  return {
    entityId: 'c1',
    entity: { id: 'c1', name: 'Acme Pvt. Ltd.' },
    actorId: 'admin-1',
    reason: 'Customer offboarding',
    comment: 'Effective today.',
    ...overrides,
  } as TransitionContext;
}

describe('ClientDormancyService', () => {
  let database: {
    db: {
      select: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let workflowEngine: { recordHistoryBatch: ReturnType<typeof vi.fn> };
  let workflowRegistry: { getBySlug: ReturnType<typeof vi.fn> };
  let events: { emitDynamic: ReturnType<typeof vi.fn> };
  let appLogger: AppLoggerService;
  let service: ClientDormancyService;

  beforeEach(() => {
    database = { db: { select: vi.fn(), update: vi.fn() } };
    workflowEngine = { recordHistoryBatch: vi.fn().mockResolvedValue([]) };
    workflowRegistry = { getBySlug: vi.fn().mockReturnValue(filingWorkflowDefinition) };
    events = { emitDynamic: vi.fn() };
    appLogger = {
      forContext: vi.fn().mockReturnValue({
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    } as unknown as AppLoggerService;

    service = new ClientDormancyService(
      database as never,
      workflowEngine as never,
      workflowRegistry as never,
      events as never,
      appLogger,
    );
  });

  describe('countNonTerminalFilings', () => {
    it('returns the count from the row, treating zero as zero', async () => {
      database.db.select.mockReturnValueOnce(mockTxSelectReturning([{ count: 0 }]));
      expect(await service.countNonTerminalFilings('c1')).toBe(0);
    });

    it('coerces non-zero counts via Number()', async () => {
      database.db.select.mockReturnValueOnce(mockTxSelectReturning([{ count: '17' }]));
      expect(await service.countNonTerminalFilings('c1')).toBe(17);
    });

    it('defaults to zero when the row is missing', async () => {
      database.db.select.mockReturnValueOnce(mockTxSelectReturning([]));
      expect(await service.countNonTerminalFilings('c1')).toBe(0);
    });
  });

  describe('cancelInFlightFilings', () => {
    function buildTx(filingsToReturn: Array<{ id: string; status: string }>) {
      const select = vi.fn(() => mockTxSelectReturning(filingsToReturn));
      const update = vi.fn(() => mockTxUpdate());
      return { select, update };
    }

    it('returns an empty result and writes nothing when there are no non-terminal filings', async () => {
      const tx = buildTx([]);
      const result = await service.cancelInFlightFilings(makeCtx(), tx);
      expect(result.cancelledFilingIds).toEqual([]);
      expect(tx.update).not.toHaveBeenCalled();
      expect(workflowEngine.recordHistoryBatch).not.toHaveBeenCalled();
    });

    it('cancels every non-terminal filing and records one history row per filing', async () => {
      const filings = [
        { id: 'f1', status: 'pending' },
        { id: 'f2', status: 'in_progress' },
        { id: 'f3', status: 'review' },
      ];
      const tx = buildTx(filings);

      const result = await service.cancelInFlightFilings(makeCtx(), tx);

      expect(result.cancelledFilingIds).toEqual(['f1', 'f2', 'f3']);
      expect(tx.update).toHaveBeenCalledTimes(1);
      expect(workflowEngine.recordHistoryBatch).toHaveBeenCalledTimes(1);
      const [historyRows, txArg] = workflowEngine.recordHistoryBatch.mock.calls[0];
      expect(txArg).toBe(tx);
      expect(historyRows).toHaveLength(3);
    });

    it('resolves transitionId from fromState for each filing', async () => {
      const filings = [
        { id: 'f1', status: 'pending' },
        { id: 'f2', status: 'in_progress' },
        { id: 'f3', status: 'review' },
        { id: 'f4', status: 'rejected' },
      ];
      const tx = buildTx(filings);

      await service.cancelInFlightFilings(makeCtx(), tx);

      const [historyRows] = workflowEngine.recordHistoryBatch.mock.calls[0];
      expect(historyRows.map((r: { entityId: string; transitionId: string }) => [r.entityId, r.transitionId])).toEqual([
        ['f1', 't-pending-cancelled'],
        ['f2', 't-in_progress-cancelled'],
        ['f3', 't-review-cancelled'],
        ['f4', 't-rejected-cancelled'],
      ]);
    });

    it('throws when a filing has a fromState with no configured transition to cancelled', async () => {
      // 'frozen' is a contrived state with no cancel transition defined.
      const filings = [
        { id: 'f1', status: 'pending' },
        { id: 'f2', status: 'frozen' },
      ];
      const tx = buildTx(filings);

      await expect(service.cancelInFlightFilings(makeCtx(), tx)).rejects.toThrow(
        /No configured transition from 'frozen' → 'cancelled'/,
      );
      // The UPDATE has already run by this point — caller's outer tx rolls back
      // the whole cascade on this throw.
      expect(tx.update).toHaveBeenCalledTimes(1);
      expect(workflowEngine.recordHistoryBatch).not.toHaveBeenCalled();
    });

    it('throws when the workflow definition is not registered', async () => {
      workflowRegistry.getBySlug.mockReturnValueOnce(undefined);
      const tx = buildTx([{ id: 'f1', status: 'pending' }]);

      await expect(service.cancelInFlightFilings(makeCtx(), tx)).rejects.toThrow(
        /Workflow definition 'compliance-filing-status' not found/,
      );
    });

    it('embeds the client name + admin comment in the history comment', async () => {
      const filings = [{ id: 'f1', status: 'pending' }];
      const tx = buildTx(filings);

      await service.cancelInFlightFilings(makeCtx({ comment: 'Migrated to new account' }), tx);

      const [historyRows] = workflowEngine.recordHistoryBatch.mock.calls[0];
      expect(historyRows[0].comment).toBe(
        'Auto-cancelled: client "Acme Pvt. Ltd." dormantised. Migrated to new account',
      );
      expect(historyRows[0].reason).toBe('Client dormantised');
    });

    it('omits the trailing comment fragment when no admin comment is supplied', async () => {
      const filings = [{ id: 'f1', status: 'pending' }];
      const tx = buildTx(filings);

      await service.cancelInFlightFilings(makeCtx({ comment: undefined }), tx);

      const [historyRows] = workflowEngine.recordHistoryBatch.mock.calls[0];
      expect(historyRows[0].comment).toBe('Auto-cancelled: client "Acme Pvt. Ltd." dormantised.');
    });

    it('falls back to clientId when the entity name is missing', async () => {
      const filings = [{ id: 'f1', status: 'pending' }];
      const tx = buildTx(filings);

      await service.cancelInFlightFilings(makeCtx({ entity: { id: 'c1' } as never }), tx);

      const [historyRows] = workflowEngine.recordHistoryBatch.mock.calls[0];
      expect(historyRows[0].comment).toContain('"c1"');
    });

    it('forwards actorId from the transition context to every history row', async () => {
      const filings = [
        { id: 'f1', status: 'pending' },
        { id: 'f2', status: 'review' },
      ];
      const tx = buildTx(filings);

      await service.cancelInFlightFilings(makeCtx({ actorId: 'specific-admin' }), tx);

      const [historyRows] = workflowEngine.recordHistoryBatch.mock.calls[0];
      expect(historyRows.every((r: { actorId: string }) => r.actorId === 'specific-admin')).toBe(true);
    });
  });

  describe('sweepLateFilings', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns no cancellations when the first sweep round finds nothing', async () => {
      database.db.select.mockReturnValueOnce(mockTxSelectReturning([]));

      const promise = service.sweepLateFilings('c1', { maxAttempts: 3, settleDelayMs: 10 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.cancelledFilingIds).toEqual([]);
      // One settle delay before the SELECT, even on the first attempt
      expect(database.db.select).toHaveBeenCalledTimes(1);
      expect(database.db.update).not.toHaveBeenCalled();
    });

    it('cancels stragglers and re-checks until a round finds none', async () => {
      // Round 1 finds two stragglers; round 2 finds nothing → loop exits.
      database.db.select
        .mockReturnValueOnce(mockTxSelectReturning([{ id: 'f1' }, { id: 'f2' }]))
        .mockReturnValueOnce(mockTxSelectReturning([]));
      database.db.update.mockReturnValueOnce(mockTxUpdate());

      const promise = service.sweepLateFilings('c1', { maxAttempts: 5, settleDelayMs: 10 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.cancelledFilingIds).toEqual(['f1', 'f2']);
      expect(database.db.select).toHaveBeenCalledTimes(2);
      expect(database.db.update).toHaveBeenCalledTimes(1);
    });

    it('caps iterations at maxAttempts even when stragglers keep appearing', async () => {
      // Every round finds the same straggler — pathological case.
      const roundResults = mockTxSelectReturning([{ id: 'f-loop' }]);
      database.db.select
        .mockReturnValue(roundResults);
      database.db.update.mockReturnValue(mockTxUpdate());

      const promise = service.sweepLateFilings('c1', { maxAttempts: 3, settleDelayMs: 10 });
      await vi.runAllTimersAsync();
      const result = await promise;

      // 3 attempts × 1 straggler each = 3 cancelled IDs
      expect(result.cancelledFilingIds).toEqual(['f-loop', 'f-loop', 'f-loop']);
      expect(database.db.select).toHaveBeenCalledTimes(3);
      expect(database.db.update).toHaveBeenCalledTimes(3);
    });

    it('uses default maxAttempts (5) and settleDelayMs (50) when options are omitted', async () => {
      database.db.select.mockReturnValue(mockTxSelectReturning([]));

      const promise = service.sweepLateFilings('c1');
      // First settle window before the first SELECT.
      await vi.advanceTimersByTimeAsync(49);
      expect(database.db.select).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      const result = await promise;

      expect(result.cancelledFilingIds).toEqual([]);
    });

    it('does not log when no stragglers are cancelled', async () => {
      const childLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
      const localLogger = { forContext: vi.fn().mockReturnValue(childLogger) } as unknown as AppLoggerService;
      const localService = new ClientDormancyService(
        database as never,
        workflowEngine as never,
        workflowRegistry as never,
        events as never,
        localLogger,
      );
      database.db.select.mockReturnValueOnce(mockTxSelectReturning([]));

      const promise = localService.sweepLateFilings('c1', { maxAttempts: 3, settleDelayMs: 10 });
      await vi.runAllTimersAsync();
      await promise;

      // Sweep silence is the documented behaviour when no stragglers exist.
      const sweepLogCalls = childLogger.log.mock.calls.filter((c: unknown[]) =>
        typeof c[0] === 'string' && c[0].includes('late filing sweep'),
      );
      expect(sweepLogCalls).toHaveLength(0);
    });
  });

  describe('emitCascadeEvent', () => {
    it('emits a single event with the cancelled filing IDs', () => {
      service.emitCascadeEvent(makeCtx(), ['f1', 'f2']);

      expect(events.emitDynamic).toHaveBeenCalledTimes(1);
      const [eventName, payload] = events.emitDynamic.mock.calls[0];
      expect(eventName).toBe('compliance.ClientDormantised');
      expect(payload).toMatchObject({
        entityType: 'clients',
        entityId: 'c1',
        actorId: 'admin-1',
        payload: {
          clientId: 'c1',
          clientName: 'Acme Pvt. Ltd.',
          reason: 'Customer offboarding',
          comment: 'Effective today.',
          cancelledFilingIds: ['f1', 'f2'],
        },
      });
    });

    it('emits even when no filings were cancelled — listeners still need to know dormantisation happened', () => {
      service.emitCascadeEvent(makeCtx(), []);

      expect(events.emitDynamic).toHaveBeenCalledTimes(1);
      const payload = events.emitDynamic.mock.calls[0][1];
      expect(payload.payload.cancelledFilingIds).toEqual([]);
    });

    it('coerces missing reason/comment to null', () => {
      service.emitCascadeEvent(makeCtx({ reason: undefined, comment: undefined }), []);

      const payload = events.emitDynamic.mock.calls[0][1];
      expect(payload.payload.reason).toBeNull();
      expect(payload.payload.comment).toBeNull();
    });

    it('falls back to clientId when the entity name is missing', () => {
      service.emitCascadeEvent(makeCtx({ entity: { id: 'c1' } as never }), []);

      const payload = events.emitDynamic.mock.calls[0][1];
      expect(payload.payload.clientName).toBe('c1');
    });
  });
});
