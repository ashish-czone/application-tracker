import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceFilingsService } from '../compliance-filings.service';

/**
 * Helper for mocking a Drizzle query chain: every method call returns the
 * same proxy, and `await`-ing the chain resolves to the supplied value.
 * Lets list tests stub `db.select(...).from(...).leftJoin(...).where(...).limit(...).offset()`
 * with a single line per call.
 */
function thenableChain<T>(value: T): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return (cb: (v: T) => unknown) => cb(value);
        return () => chain;
      },
    },
  );
  return chain;
}

describe('ComplianceFilingsService', () => {
  // After the workflow-lift, the service no longer injects EntityService.
  // CRUD goes through `crud` (BaseCrudService). Workflow ops go through
  // `workflowEngine` + `workflowRegistry`. Scope predicates come from
  // `dataAccessScope` directly. `list` builds its own SQL (driver +
  // LEFT JOINs to clients/users/org_units) and is tested by stubbing
  // `database.db.select` per call. `getSummary` is a single raw SQL with
  // COUNT FILTER, so its tests mock `database.db.execute`.
  let crud: {
    list: ReturnType<typeof vi.fn>;
    findOneOrFail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let workflowEngine: {
    validateAndThrow: ReturnType<typeof vi.fn>;
    recordHistory: ReturnType<typeof vi.fn>;
  };
  let workflowRegistry: { getByEntityField: ReturnType<typeof vi.fn> };
  let dataAccessScope: { buildPredicate: ReturnType<typeof vi.fn> };
  let events: { emitDynamic: ReturnType<typeof vi.fn> };
  let lawsService: { findDisplayByIds: ReturnType<typeof vi.fn> };
  let database: {
    db: {
      execute: ReturnType<typeof vi.fn>;
      transaction: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
    };
  };
  let service: ComplianceFilingsService;

  beforeEach(() => {
    crud = {
      list: vi.fn(),
      findOneOrFail: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'filing-1' }),
      update: vi.fn().mockResolvedValue({ id: 'filing-1' }),
      softDelete: vi.fn(),
    };
    workflowEngine = {
      validateAndThrow: vi.fn(),
      recordHistory: vi.fn().mockResolvedValue({ historyId: 'h1', recordedAt: '2026-04-30T00:00:00Z' }),
    };
    workflowRegistry = { getByEntityField: vi.fn() };
    dataAccessScope = { buildPredicate: vi.fn().mockResolvedValue(undefined) };
    events = { emitDynamic: vi.fn() };
    lawsService = {
      findDisplayByIds: vi.fn().mockResolvedValue([]),
    };
    database = {
      db: {
        execute: vi.fn().mockResolvedValue({ rows: [{}] }),
        transaction: vi.fn(),
        select: vi.fn(),
      },
    };
    service = new ComplianceFilingsService(
      crud as never,
      lawsService as never,
      database as never,
      events as never,
      workflowEngine as never,
      workflowRegistry as never,
      dataAccessScope as never,
    );
  });

  describe('create — externalKey derivation', () => {
    it('derives externalKey from (ruleId, clientId, periodStart) when absent', async () => {
      await service.create(
        {
          title: 'Filing',
          ruleId: 'r1',
          clientId: 'c1',
          periodStart: '2026-04-01',
        } as never,
        'actor',
      );
      const payload = crud.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.externalKey).toBe('r1:c1:2026-04-01');
    });

    it('preserves externalKey when already set', async () => {
      await service.create(
        {
          title: 'Filing',
          ruleId: 'r1',
          clientId: 'c1',
          periodStart: '2026-04-01',
          externalKey: 'pre-set-key',
        } as never,
        'actor',
      );
      const payload = crud.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.externalKey).toBe('pre-set-key');
    });

    it('does not set externalKey when the tuple is incomplete', async () => {
      await service.create({ title: 'Filing', ruleId: 'r1' } as never, 'actor');
      const payload = crud.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.externalKey).toBeUndefined();
    });
  });

  describe('create — workflow initial state', () => {
    it('forces status to the workflow initialState regardless of input', async () => {
      // Workflow state is system-managed: even if a caller bypasses the DTO
      // and passes `status: 'completed'` directly to the service, the service
      // overrides with COMPLIANCE_FILINGS_WORKFLOW.initialState ('pending').
      // See `.claude/rules/workflow-entity-creates.md`.
      await service.create({ title: 'Filing', status: 'completed' } as never, 'actor');
      const payload = crud.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.status).toBe('pending');
      expect(payload.completedAt).toBeNull();
    });

    it('stamps status=pending and completedAt=null when no status supplied', async () => {
      await service.create({ title: 'Filing' } as never, 'actor');
      const payload = crud.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.status).toBe('pending');
      expect(payload.completedAt).toBeNull();
    });
  });

  describe('update — completedAt stamping', () => {
    it('stamps completedAt when transitioning to completed', async () => {
      await service.update('id', { status: 'completed' } as never, 'actor');
      const payload = crud.update.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when transitioning away from completed', async () => {
      await service.update('id', { status: 'in_progress' } as never, 'actor');
      const payload = crud.update.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.completedAt).toBeNull();
    });

    it('does not touch completedAt when status is not in the payload', async () => {
      await service.update('id', { title: 'new title' } as never, 'actor');
      const payload = crud.update.mock.calls[0][1] as Record<string, unknown>;
      expect('completedAt' in payload).toBe(false);
    });
  });

  describe('list — joined display columns + law hydration', () => {
    /**
     * Stubs the two `database.db.select` calls in `service.list`:
     * 1. rows query (filing + clientName + assigneeFirstName/LastName + assigneeTeamName)
     * 2. count query ([{ total }])
     */
    function stubSelect(rows: unknown[], total: number) {
      database.db.select
        .mockReturnValueOnce(thenableChain(rows))
        .mockReturnValueOnce(thenableChain([{ total }]));
    }

    it('flattens joined columns and stamps lawCode/lawName/lawJurisdiction from a single batched LawsService call', async () => {
      stubSelect(
        [
          {
            filing: { id: 'f1', lawId: 'law-a', clientId: 'c1', assigneeId: 'u1', assigneeTeamId: 't1' },
            clientName: 'Acme',
            assigneeFirstName: 'Jane',
            assigneeLastName: 'Doe',
            assigneeTeamName: 'GST Team',
          },
          {
            filing: { id: 'f2', lawId: 'law-b', clientId: 'c2', assigneeId: 'u2', assigneeTeamId: 't1' },
            clientName: 'Beta Corp',
            assigneeFirstName: 'John',
            assigneeLastName: 'Smith',
            assigneeTeamName: 'GST Team',
          },
          {
            filing: { id: 'f3', lawId: 'law-a', clientId: 'c3', assigneeId: null, assigneeTeamId: 't2' },
            clientName: 'Gamma Ltd',
            assigneeFirstName: null,
            assigneeLastName: null,
            assigneeTeamName: 'TDS Team',
          },
        ],
        3,
      );
      lawsService.findDisplayByIds.mockResolvedValue([
        { id: 'law-a', code: 'XYZ-12', name: 'Law A', jurisdiction: 'central' },
        { id: 'law-b', code: 'ABC-99', name: 'Law B', jurisdiction: 'state' },
      ]);

      const result = await service.list({});

      // One batched call to laws covering both law-a and law-b.
      expect(lawsService.findDisplayByIds).toHaveBeenCalledTimes(1);
      const idsArg = lawsService.findDisplayByIds.mock.calls[0][0] as string[];
      expect(new Set(idsArg)).toEqual(new Set(['law-a', 'law-b']));

      expect(result.data).toEqual([
        {
          id: 'f1', lawId: 'law-a', clientId: 'c1', assigneeId: 'u1', assigneeTeamId: 't1',
          clientName: 'Acme', assigneeFirstName: 'Jane', assigneeLastName: 'Doe', assigneeTeamName: 'GST Team',
          lawCode: 'XYZ-12', lawName: 'Law A', lawJurisdiction: 'central',
        },
        {
          id: 'f2', lawId: 'law-b', clientId: 'c2', assigneeId: 'u2', assigneeTeamId: 't1',
          clientName: 'Beta Corp', assigneeFirstName: 'John', assigneeLastName: 'Smith', assigneeTeamName: 'GST Team',
          lawCode: 'ABC-99', lawName: 'Law B', lawJurisdiction: 'state',
        },
        {
          id: 'f3', lawId: 'law-a', clientId: 'c3', assigneeId: null, assigneeTeamId: 't2',
          clientName: 'Gamma Ltd', assigneeFirstName: null, assigneeLastName: null, assigneeTeamName: 'TDS Team',
          lawCode: 'XYZ-12', lawName: 'Law A', lawJurisdiction: 'central',
        },
      ]);
    });

    it('skips the LawsService call when no rows have a lawId', async () => {
      stubSelect(
        [
          {
            filing: { id: 'f1', clientId: 'c1', assigneeId: null, assigneeTeamId: 't1' },
            clientName: 'Acme',
            assigneeFirstName: null,
            assigneeLastName: null,
            assigneeTeamName: 'GST Team',
          },
        ],
        1,
      );

      const result = await service.list({});

      expect(lawsService.findDisplayByIds).not.toHaveBeenCalled();
      expect(result.data).toEqual([
        {
          id: 'f1', clientId: 'c1', assigneeId: null, assigneeTeamId: 't1',
          clientName: 'Acme', assigneeFirstName: null, assigneeLastName: null, assigneeTeamName: 'GST Team',
        },
      ]);
    });

    it('leaves law-display columns off a row whose lawId is missing from the law batch', async () => {
      stubSelect(
        [
          {
            filing: { id: 'f1', lawId: 'law-a' },
            clientName: null, assigneeFirstName: null, assigneeLastName: null, assigneeTeamName: null,
          },
          {
            filing: { id: 'f2', lawId: 'law-deleted' },
            clientName: null, assigneeFirstName: null, assigneeLastName: null, assigneeTeamName: null,
          },
        ],
        2,
      );
      lawsService.findDisplayByIds.mockResolvedValue([
        { id: 'law-a', code: 'XYZ-12', name: 'Law A', jurisdiction: 'central' },
      ]);

      const result = await service.list({});

      expect(result.data).toEqual([
        {
          id: 'f1', lawId: 'law-a',
          clientName: null, assigneeFirstName: null, assigneeLastName: null, assigneeTeamName: null,
          lawCode: 'XYZ-12', lawName: 'Law A', lawJurisdiction: 'central',
        },
        {
          id: 'f2', lawId: 'law-deleted',
          clientName: null, assigneeFirstName: null, assigneeLastName: null, assigneeTeamName: null,
        },
      ]);
    });

    it('returns meta computed from the count query and pagination inputs', async () => {
      stubSelect([], 47);

      const result = await service.list({ page: 2, limit: 20 });

      expect(result.meta).toEqual({ page: 2, limit: 20, total: 47, totalPages: 3 });
    });

    it('clamps limit to the [1, 100] range and computes totalPages accordingly', async () => {
      stubSelect([], 0);

      // limit > 100 clamps to 100; total=0 still yields totalPages=1 (Math.ceil(0/100)=0 → max(1,0)).
      const result = await service.list({ page: 1, limit: 9999 });

      expect(result.meta).toEqual({ page: 1, limit: 100, total: 0, totalPages: 1 });
    });
  });

  describe('getSummary — KPI counts', () => {
    // Single raw SQL replaces the 7 list-call fan-out. The test mocks
    // `database.db.execute` with the aggregated row shape and verifies
    // mapping. SQL-shape correctness is exercised by integration tests
    // against a real database.
    it('returns mapped counts from the single aggregation query', async () => {
      database.db.execute.mockResolvedValueOnce({
        rows: [{
          total: 100,
          overdue: 12,
          due_today: 3,
          due_this_week: 8,
          upcoming: 45,
          completed: 28,
          cancelled: 4,
          overdue_client_count: 7,
        }],
      });

      const summary = await service.getSummary('2026-04-30');

      expect(database.db.execute).toHaveBeenCalledTimes(1);
      expect(summary).toEqual({
        total: 100,
        overdue: 12,
        dueToday: 3,
        dueThisWeek: 8,
        upcoming: 45,
        completed: 28,
        cancelled: 4,
        overdueClientCount: 7,
      });
    });

    it('returns zeroes when the aggregation row is empty', async () => {
      database.db.execute.mockResolvedValueOnce({ rows: [] });

      const summary = await service.getSummary('2026-04-30');

      expect(summary).toEqual({
        total: 0,
        overdue: 0,
        dueToday: 0,
        dueThisWeek: 0,
        upcoming: 0,
        completed: 0,
        cancelled: 0,
        overdueClientCount: 0,
      });
    });

    it('builds the scope predicate via DataAccessScopeService when accessCtx is supplied', async () => {
      const accessCtx = { userId: 'u1', scopes: [{ type: 'unit' }] } as never;
      const fakePredicate = { __tag: 'scope-sql' } as never;
      dataAccessScope.buildPredicate.mockResolvedValueOnce(fakePredicate);
      database.db.execute.mockResolvedValueOnce({ rows: [{}] });

      await service.getSummary('2026-04-30', undefined, accessCtx);

      expect(dataAccessScope.buildPredicate).toHaveBeenCalledWith(
        accessCtx,
        expect.objectContaining({
          anchors: expect.any(Object),
          inlineResolvers: expect.any(Array),
        }),
      );
    });

    it('skips DataAccessScopeService entirely when accessCtx is omitted', async () => {
      database.db.execute.mockResolvedValueOnce({ rows: [{}] });

      await service.getSummary('2026-04-30');

      expect(dataAccessScope.buildPredicate).not.toHaveBeenCalled();
    });
  });
});
