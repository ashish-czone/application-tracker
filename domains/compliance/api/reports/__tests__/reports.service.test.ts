import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceReportsService } from '../reports.service';

/**
 * Unit tests for the ComplianceReportsService — the hand-rolled
 * Drizzle-aggregation path for the five report endpoints (trend,
 * by-client, aging, severity, team-workload). Per the test-coverage
 * audit (HIGH #3), this service had zero unit AND zero integration
 * tests, despite each method building intricate CASE expressions for
 * on-time / late / overdue derivation.
 *
 * Scope: row mapping, scope predicate forwarding, post-resolve
 * filters, on-time-rate maths. Actual SQL semantics belong in
 * integration tests against a real DB (separate follow-up).
 */

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

/**
 * Drizzle chain that resolves on whichever terminal method (`.orderBy()` or
 * `.groupBy()` when there's no ORDER BY) is awaited last. The chain itself is
 * a thenable — awaiting any intermediate node resolves to the rows.
 */
function chainResolving<T>(rows: T[]): AnyChain {
  const chain: AnyChain = {} as AnyChain;
  const resolve = () => Promise.resolve(rows);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  // Make the chain awaitable as a Promise<rows>.
  (chain as unknown as { then: typeof Promise.prototype.then }).then = (
    onFulfilled?: (value: T[]) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => resolve().then(onFulfilled, onRejected);
  return chain;
}

describe('ComplianceReportsService', () => {
  let database: {
    db: { select: ReturnType<typeof vi.fn> };
  };
  let orgUnits: { findAll: ReturnType<typeof vi.fn> };
  let filingsEntity: { getScopePredicate: ReturnType<typeof vi.fn> };
  let service: ComplianceReportsService;

  beforeEach(() => {
    database = { db: { select: vi.fn() } };
    orgUnits = { findAll: vi.fn().mockResolvedValue([]) };
    filingsEntity = { getScopePredicate: vi.fn().mockResolvedValue(undefined) };
    service = new ComplianceReportsService(
      database as never,
      orgUnits as never,
      filingsEntity as never,
    );
  });

  describe('getTrend', () => {
    it('maps rows into TrendBucket[] with numeric coercion', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([
          { month: '2026-01', onTime: '12', late: '2', overdue: '1' },
          { month: '2026-02', onTime: 8, late: 0, overdue: 3 },
        ]),
      );

      const result = await service.getTrend({ from: '2026-01-01', to: '2026-04-30' }, '2026-04-30');

      expect(result).toEqual([
        { month: '2026-01', onTime: 12, late: 2, overdue: 1 },
        { month: '2026-02', onTime: 8, late: 0, overdue: 3 },
      ]);
    });

    it('forwards accessCtx to the entity service for scope resolution', async () => {
      database.db.select.mockReturnValueOnce(chainResolving([]));
      const accessCtx = { userId: 'u1', scopes: [{ type: 'unit' }] } as never;

      await service.getTrend({ from: '2026-01-01', to: '2026-04-30' }, '2026-04-30', accessCtx);

      expect(filingsEntity.getScopePredicate).toHaveBeenCalledWith(accessCtx);
    });

    it('skips scope resolution when no accessCtx is supplied', async () => {
      database.db.select.mockReturnValueOnce(chainResolving([]));
      await service.getTrend({ from: '2026-01-01', to: '2026-04-30' }, '2026-04-30');
      expect(filingsEntity.getScopePredicate).not.toHaveBeenCalled();
    });
  });

  describe('getByClient', () => {
    it('computes onTimeRate as onTime / (onTime + late + overdue) percent', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([
          { clientId: 'c1', clientName: 'Acme', totalFilings: 10, onTime: 7, late: 2, overdue: 1 },
        ]),
      );

      const result = await service.getByClient(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
      );

      // 7 / (7+2+1) = 70%
      expect(result[0].onTimeRate).toBe(70);
    });

    it('returns 0 onTimeRate when there are no filings to attribute', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([
          { clientId: 'c1', clientName: 'Empty', totalFilings: 0, onTime: 0, late: 0, overdue: 0 },
        ]),
      );

      const result = await service.getByClient(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
      );

      expect(result[0].onTimeRate).toBe(0);
    });

    it('coerces null clientName to empty string', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([
          { clientId: 'c1', clientName: null, totalFilings: 1, onTime: 1, late: 0, overdue: 0 },
        ]),
      );

      const result = await service.getByClient(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
      );

      expect(result[0].clientName).toBe('');
    });

    it('forwards accessCtx for scope resolution', async () => {
      database.db.select.mockReturnValueOnce(chainResolving([]));
      const accessCtx = { userId: 'u1', scopes: [{ type: 'any' }] } as never;

      await service.getByClient({ from: '2026-01-01', to: '2026-04-30' }, '2026-04-30', undefined, accessCtx);

      expect(filingsEntity.getScopePredicate).toHaveBeenCalledWith(accessCtx);
    });

    it('passes the search query through unchanged when supplied', async () => {
      database.db.select.mockReturnValueOnce(chainResolving([]));

      await service.getByClient(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
        { q: '  Acme  ' },
      );

      // Only assertion at the unit level: the chain was invoked exactly once
      // — semantic verification of the ILIKE predicate belongs in integration.
      expect(database.db.select).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOverdueAging', () => {
    it('returns all four buckets in fixed order, defaulting missing buckets to 0', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([
          { range: '1-7', count: 3 },
          { range: '30+', count: 5 },
        ]),
      );

      const result = await service.getOverdueAging('2026-04-30');

      expect(result).toEqual([
        { range: '1-7', count: 3 },
        { range: '8-15', count: 0 },
        { range: '16-30', count: 0 },
        { range: '30+', count: 5 },
      ]);
    });

    it('coerces string counts to number', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([{ range: '1-7', count: '12' }]),
      );

      const result = await service.getOverdueAging('2026-04-30');

      expect(result[0].count).toBe(12);
    });

    it('forwards accessCtx for scope resolution', async () => {
      database.db.select.mockReturnValueOnce(chainResolving([]));
      const accessCtx = { userId: 'u1', scopes: [{ type: 'unit' }] } as never;

      await service.getOverdueAging('2026-04-30', accessCtx);

      expect(filingsEntity.getScopePredicate).toHaveBeenCalledWith(accessCtx);
    });
  });

  describe('getOverdueSeverity', () => {
    it('maps rows to SeverityBreakdownRow[]', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([
          { priority: 'high', count: 7 },
          { priority: 'medium', count: 3 },
        ]),
      );

      const result = await service.getOverdueSeverity('2026-04-30');

      expect(result).toEqual([
        { priority: 'high', count: 7 },
        { priority: 'medium', count: 3 },
      ]);
    });

    it('forwards accessCtx for scope resolution', async () => {
      database.db.select.mockReturnValueOnce(chainResolving([]));
      const accessCtx = { userId: 'u1', scopes: [{ type: 'unit' }] } as never;

      await service.getOverdueSeverity('2026-04-30', accessCtx);

      expect(filingsEntity.getScopePredicate).toHaveBeenCalledWith(accessCtx);
    });
  });

  describe('getTeamWorkload', () => {
    it('joins team names from OrgUnitService and maps onTimeRate from completed/(completed+late)', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([
          {
            assigneeTeamId: 't1',
            totalAssigned: 10,
            completed: 7,
            inProgress: 1,
            overdue: 2,
            onTime: 6,
            late: 1,
          },
        ]),
      );
      orgUnits.findAll.mockResolvedValueOnce([{ id: 't1', name: 'GST Team' }]);

      const result = await service.getTeamWorkload(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
      );

      expect(result).toEqual([
        {
          assigneeTeamId: 't1',
          assigneeTeamName: 'GST Team',
          totalAssigned: 10,
          completed: 7,
          inProgress: 1,
          overdue: 2,
          // onTime / (onTime + late) → 6 / 7 → 86%
          onTimeRate: 86,
        },
      ]);
    });

    it('falls back to empty team name when the org unit is missing', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([
          {
            assigneeTeamId: 'orphan',
            totalAssigned: 1,
            completed: 0,
            inProgress: 1,
            overdue: 0,
            onTime: 0,
            late: 0,
          },
        ]),
      );
      orgUnits.findAll.mockResolvedValueOnce([]);

      const result = await service.getTeamWorkload(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
      );

      expect(result[0].assigneeTeamName).toBe('');
      // No completions → onTimeRate is 0 (avoids divide-by-zero)
      expect(result[0].onTimeRate).toBe(0);
    });

    it('post-resolve search filter: drops teams whose name does not contain q (case-insensitive)', async () => {
      database.db.select.mockReturnValueOnce(
        chainResolving([
          { assigneeTeamId: 't1', totalAssigned: 1, completed: 0, inProgress: 0, overdue: 0, onTime: 0, late: 0 },
          { assigneeTeamId: 't2', totalAssigned: 1, completed: 0, inProgress: 0, overdue: 0, onTime: 0, late: 0 },
        ]),
      );
      orgUnits.findAll.mockResolvedValueOnce([
        { id: 't1', name: 'GST Team' },
        { id: 't2', name: 'TDS Squad' },
      ]);

      const result = await service.getTeamWorkload(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
        { q: 'gst' },
      );

      expect(result.map((r) => r.assigneeTeamName)).toEqual(['GST Team']);
    });

    it('forwards accessCtx for scope resolution', async () => {
      database.db.select.mockReturnValueOnce(chainResolving([]));
      const accessCtx = { userId: 'u1', scopes: [{ type: 'unit' }] } as never;

      await service.getTeamWorkload(
        { from: '2026-01-01', to: '2026-04-30' },
        '2026-04-30',
        undefined,
        accessCtx,
      );

      expect(filingsEntity.getScopePredicate).toHaveBeenCalledWith(accessCtx);
    });
  });
});
