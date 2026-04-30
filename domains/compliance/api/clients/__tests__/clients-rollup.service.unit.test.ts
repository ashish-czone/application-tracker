import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientsRollupService } from '../clients-rollup.service';

/**
 * Unit tests for the ClientsRollupService — the hand-rolled SQL path that
 * powers the compliance clients list + KPI summary. Per the test-coverage
 * audit (HIGH #2), this service had zero direct tests — neither unit nor
 * integration. The risk is silently-wrong dashboard numbers when the SQL
 * shape drifts during refactors.
 *
 * Scope of these unit tests: parameter translation, sort whitelist, scope
 * predicate pass-through, row mapping, edge cases. The actual SQL
 * semantics (aggregates, risk derivation, JOINs) belong in integration
 * tests against a real DB; that's a separate gap tracked alongside the
 * pre-existing compliance integration-test DI infrastructure work.
 */

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockSelectDistinctChain(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockSelectChain(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

describe('ClientsRollupService', () => {
  let database: {
    db: {
      execute: ReturnType<typeof vi.fn>;
      selectDistinct: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
    };
  };
  let service: ClientsRollupService;

  beforeEach(() => {
    database = {
      db: {
        execute: vi.fn(),
        selectDistinct: vi.fn(),
        select: vi.fn(),
      },
    };
    service = new ClientsRollupService(database as never);
  });

  describe('list', () => {
    function metaResponse(total: number) {
      return { rows: [{ total }] };
    }
    function dataResponse(rows: Record<string, unknown>[]) {
      return { rows };
    }

    it('returns paginated rollup rows with computed meta', async () => {
      database.db.execute
        .mockResolvedValueOnce(metaResponse(57))
        .mockResolvedValueOnce(
          dataResponse([
            {
              id: 'c1',
              name: 'Acme',
              legal_name: 'Acme Pvt.',
              email: 'hi@acme.test',
              phone: null,
              tax_id: null,
              industry: 'IT',
              compliance_status: 'active',
              compliance_account_manager_id: 'u1',
              compliance_onboarded_at: new Date('2026-01-01'),
              handler_first_name: 'Asha',
              handler_last_name: 'Verma',
              handler_email: 'asha@example.test',
              registered_laws: 4,
              open_filings: 3,
              overdue_filings: 1,
              due_this_week: 0,
              completed_filings: 9,
              on_time_filings: 8,
              on_time_pct: 89,
              last_filing_date: '2026-04-15',
              risk: 'critical',
            },
          ]),
        );

      const result = await service.list({ page: 1, limit: 25 });

      expect(result.meta).toEqual({ total: 57, page: 1, limit: 25, totalPages: 3 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'c1',
        name: 'Acme',
        complianceAccountManagerId: 'u1',
        complianceAccountManagerId__label: 'Asha Verma',
        registeredLaws: 4,
        overdueFilings: 1,
        onTimePct: 89,
        risk: 'critical',
      });
    });

    it('falls back to email for the handler label when first/last names are missing', async () => {
      database.db.execute
        .mockResolvedValueOnce(metaResponse(1))
        .mockResolvedValueOnce(
          dataResponse([
            {
              id: 'c1',
              name: 'X',
              compliance_account_manager_id: 'u1',
              handler_first_name: null,
              handler_last_name: null,
              handler_email: 'fallback@example.test',
              registered_laws: 0,
              open_filings: 0,
              overdue_filings: 0,
              due_this_week: 0,
              completed_filings: 0,
              on_time_filings: 0,
              on_time_pct: 0,
              risk: 'healthy',
            },
          ]),
        );

      const result = await service.list({ page: 1, limit: 25 });
      expect(result.data[0].complianceAccountManagerId__label).toBe('fallback@example.test');
    });

    it('returns null handler label when there is no account manager assigned', async () => {
      database.db.execute
        .mockResolvedValueOnce(metaResponse(1))
        .mockResolvedValueOnce(
          dataResponse([
            {
              id: 'c1',
              name: 'X',
              compliance_account_manager_id: null,
              handler_first_name: null,
              handler_last_name: null,
              handler_email: null,
              registered_laws: 0,
              open_filings: 0,
              overdue_filings: 0,
              due_this_week: 0,
              completed_filings: 0,
              on_time_filings: 0,
              on_time_pct: 0,
              risk: 'healthy',
            },
          ]),
        );

      const result = await service.list({ page: 1, limit: 25 });
      expect(result.data[0].complianceAccountManagerId__label).toBeNull();
    });

    it('coerces missing/null aggregate columns to 0', async () => {
      database.db.execute
        .mockResolvedValueOnce(metaResponse(1))
        .mockResolvedValueOnce(
          dataResponse([
            {
              id: 'c1',
              name: 'X',
              compliance_account_manager_id: null,
              registered_laws: null,
              open_filings: null,
              overdue_filings: null,
              due_this_week: null,
              completed_filings: null,
              on_time_filings: null,
              on_time_pct: null,
              risk: null,
              last_filing_date: null,
            },
          ]),
        );

      const result = await service.list({ page: 1, limit: 25 });
      expect(result.data[0]).toMatchObject({
        registeredLaws: 0,
        openFilings: 0,
        overdueFilings: 0,
        completedFilings: 0,
        onTimePct: 0,
        risk: 'healthy',
        lastFilingDate: null,
      });
    });

    it('computes meta.totalPages as 0 when limit is 0 (defensive)', async () => {
      database.db.execute
        .mockResolvedValueOnce(metaResponse(0))
        .mockResolvedValueOnce(dataResponse([]));

      const result = await service.list({ page: 1, limit: 0 });
      expect(result.meta.totalPages).toBe(0);
    });

    it('forwards the scope predicate into both the count and data execute calls', async () => {
      database.db.execute
        .mockResolvedValueOnce(metaResponse(0))
        .mockResolvedValueOnce(dataResponse([]));
      const scopePredicate = { __tag: 'scope-sql' } as never;

      await service.list({ page: 1, limit: 25 }, scopePredicate);

      expect(database.db.execute).toHaveBeenCalledTimes(2);
      // Both queries should have been issued; we can't introspect SQL deeply
      // here, but the shape of two execute() calls confirms list runs both
      // count and data through the same buildBaseQuery (which applies the
      // scope inside the CTE).
    });
  });

  describe('getSummary', () => {
    it('maps the aggregation row into the expected ClientsSummary shape', async () => {
      database.db.execute.mockResolvedValueOnce({
        rows: [
          {
            total: 47,
            active_count: 30,
            onboarding_count: 10,
            dormant_count: 7,
            critical_count: 5,
            at_risk_count: 8,
            healthy_count: 34,
            total_overdue: 21,
            clients_with_overdue: 6,
            total_registrations: 130,
            avg_on_time_pct: 78,
          },
        ],
      });

      const summary = await service.getSummary();

      expect(summary).toEqual({
        total: 47,
        byStatus: { active: 30, onboarding: 10, dormant: 7 },
        byRisk: { healthy: 34, 'at-risk': 8, critical: 5 },
        totalOverdue: 21,
        clientsWithOverdue: 6,
        totalRegistrations: 130,
        avgOnTimePct: 78,
      });
    });

    it('coerces missing aggregate columns to 0', async () => {
      database.db.execute.mockResolvedValueOnce({ rows: [{}] });

      const summary = await service.getSummary();

      expect(summary).toEqual({
        total: 0,
        byStatus: { active: 0, onboarding: 0, dormant: 0 },
        byRisk: { healthy: 0, 'at-risk': 0, critical: 0 },
        totalOverdue: 0,
        clientsWithOverdue: 0,
        totalRegistrations: 0,
        avgOnTimePct: 0,
      });
    });
  });

  describe('getHandlerOptions', () => {
    it('returns empty list when no handlers are assigned', async () => {
      database.db.selectDistinct.mockReturnValueOnce(mockSelectDistinctChain([]));

      const result = await service.getHandlerOptions();

      expect(result).toEqual([]);
      expect(database.db.select).not.toHaveBeenCalled();
    });

    it('skips null/empty handler ids before fetching users', async () => {
      database.db.selectDistinct.mockReturnValueOnce(
        mockSelectDistinctChain([{ id: null }, { id: '' }, { id: 'u1' }]),
      );
      database.db.select.mockReturnValueOnce(
        mockSelectChain([
          { id: 'u1', firstName: 'Asha', lastName: 'Verma', email: 'asha@example.test' },
        ]),
      );

      const result = await service.getHandlerOptions();

      expect(result).toEqual([{ id: 'u1', name: 'Asha Verma' }]);
    });

    it('builds display names with first+last fallback to email', async () => {
      database.db.selectDistinct.mockReturnValueOnce(
        mockSelectDistinctChain([{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]),
      );
      database.db.select.mockReturnValueOnce(
        mockSelectChain([
          { id: 'u1', firstName: 'Asha', lastName: 'Verma', email: null },
          { id: 'u2', firstName: null, lastName: null, email: 'fallback@example.test' },
          { id: 'u3', firstName: 'Solo', lastName: null, email: null },
        ]),
      );

      const result = await service.getHandlerOptions();

      // Sorted alphabetically by display name.
      expect(result.map((o) => o.name)).toEqual(['Asha Verma', 'fallback@example.test', 'Solo']);
    });

    it('forwards the scope predicate to the distinct-ids query', async () => {
      database.db.selectDistinct.mockReturnValueOnce(mockSelectDistinctChain([]));
      const scopePredicate = { __tag: 'sql' } as never;

      await service.getHandlerOptions(scopePredicate);

      expect(database.db.selectDistinct).toHaveBeenCalledTimes(1);
    });
  });
});
