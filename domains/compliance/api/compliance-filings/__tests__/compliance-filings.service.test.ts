import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
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

/**
 * Variant of `thenableChain` that records the arguments passed to specific
 * methods (e.g. `.where(...)`, `.orderBy(...)`) on the supplied `recorder`
 * object so list-shape tests can assert structurally on the WHERE / ORDER BY
 * Drizzle SQL objects. Other methods still chain through.
 */
function recordingChain<T>(value: T, recorder: Record<string, unknown[]>, methods: string[]): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return (cb: (v: T) => unknown) => cb(value);
        if (typeof prop === 'string' && methods.includes(prop)) {
          return (...args: unknown[]) => {
            recorder[prop] = args;
            return chain;
          };
        }
        return () => chain;
      },
    },
  );
  return chain;
}

/**
 * Render a captured Drizzle SQL object (as passed to `.where(...)` or
 * `.orderBy(...)`) into its compiled `{sql, params}` shape so tests can
 * assert on substring matches without depending on Drizzle internals.
 */
const dialect = new PgDialect();
function compileSql(sqlObj: unknown): { sql: string; params: unknown[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return dialect.sqlToQuery(sqlObj as any);
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

  describe('list — filters / sort / search', () => {
    /**
     * Stub the rows query with a recording chain (captures `.where()` and
     * `.orderBy()` for assertions) and the count query with the plain
     * thenable. Returns the recorder so the test can compile the SQL.
     */
    function stubSelectCapturing(rows: unknown[], total: number) {
      const recorder: Record<string, unknown[]> = {};
      database.db.select
        .mockReturnValueOnce(recordingChain(rows, recorder, ['where', 'orderBy']))
        .mockReturnValueOnce(thenableChain([{ total }]));
      return recorder;
    }

    /**
     * Variant that captures BOTH the rows-query WHERE and the count-query
     * WHERE so the test can assert they are structurally identical (same
     * scope + filter shape).
     */
    function stubSelectCapturingBoth(rows: unknown[], total: number) {
      const rowsRec: Record<string, unknown[]> = {};
      const countRec: Record<string, unknown[]> = {};
      database.db.select
        .mockReturnValueOnce(recordingChain(rows, rowsRec, ['where', 'orderBy']))
        .mockReturnValueOnce(recordingChain([{ total }], countRec, ['where']));
      return { rowsRec, countRec };
    }

    it('translates filters JSON eq predicates into a WHERE that pins the column', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({
        filters: JSON.stringify([
          { field: 'clientId', operator: 'eq', value: 'c1' },
        ]),
      });

      const where = recorder.where?.[0];
      expect(where).toBeDefined();
      const compiled = compileSql(where);
      // Column reference + parameter binding — Drizzle uses positional
      // placeholders, so the substring + params assertion is structural.
      expect(compiled.sql).toContain('"client_id"');
      expect(compiled.params).toContain('c1');
    });

    it('translates filters JSON in operator into an inArray predicate', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({
        filters: JSON.stringify([
          { field: 'lawId', operator: 'in', value: ['l1', 'l2', 'l3'] },
        ]),
      });

      const compiled = compileSql(recorder.where?.[0]);
      expect(compiled.sql).toContain('"law_id"');
      expect(compiled.sql).toMatch(/in\s*\(/i);
      expect(compiled.params).toEqual(expect.arrayContaining(['l1', 'l2', 'l3']));
    });

    it('translates filters JSON lte / gte predicates against dueDate', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({
        filters: JSON.stringify([
          { field: 'dueDate', operator: 'lte', value: '2026-04-30' },
          { field: 'dueDate', operator: 'gte', value: '2026-04-01' },
        ]),
      });

      const compiled = compileSql(recorder.where?.[0]);
      expect(compiled.sql).toContain('"due_date"');
      expect(compiled.sql).toMatch(/<=|>=/);
      expect(compiled.params).toEqual(expect.arrayContaining(['2026-04-30', '2026-04-01']));
    });

    it('ignores unknown filter fields (whitelist enforced) without 400-ing', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({
        filters: JSON.stringify([
          { field: 'notAColumn', operator: 'eq', value: 'whatever' },
          { field: 'status', operator: 'eq', value: 'pending' },
        ]),
      });

      const compiled = compileSql(recorder.where?.[0]);
      expect(compiled.sql).not.toContain('notAColumn');
      expect(compiled.sql).not.toContain('not_a_column');
      expect(compiled.sql).toContain('"status"');
      expect(compiled.params).toContain('pending');
    });

    it('honors bare passthrough id params (clientId / lawId / assigneeId / assigneeTeamId / ruleId)', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({
        clientId: 'c-bare',
        lawId: 'l-bare',
        ruleId: 'r-bare',
        assigneeId: 'u-bare',
        assigneeTeamId: 't-bare',
      });

      const compiled = compileSql(recorder.where?.[0]);
      expect(compiled.params).toEqual(
        expect.arrayContaining(['c-bare', 'l-bare', 'r-bare', 'u-bare', 't-bare']),
      );
    });

    it('renders ORDER BY against the sort whitelist with stable id tiebreaker', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({ sort: 'dueDate', order: 'desc' });

      const orderBy = recorder.orderBy ?? [];
      // Two arguments: primary sort + id tiebreaker.
      expect(orderBy.length).toBe(2);
      const primary = compileSql(orderBy[0]);
      const tiebreaker = compileSql(orderBy[1]);
      expect(primary.sql).toContain('"due_date"');
      expect(primary.sql).toMatch(/desc/i);
      expect(tiebreaker.sql).toContain('"id"');
      expect(tiebreaker.sql).toMatch(/asc/i);
    });

    it('falls back to the default sort when sort key is not whitelisted', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({ sort: 'arbitraryColumn', order: 'desc' });

      const primary = compileSql((recorder.orderBy ?? [])[0]);
      // Default column is dueDate.
      expect(primary.sql).toContain('"due_date"');
    });

    it('renders sort against a joined display column from the whitelist', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({ sort: 'clientName', order: 'asc' });

      const primary = compileSql((recorder.orderBy ?? [])[0]);
      // clientName resolves to clients.name
      expect(primary.sql).toContain('"name"');
      expect(primary.sql).toMatch(/asc/i);
    });

    it('OR-composes ILIKE predicates across title / description / externalKey / clients.name for search', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({ search: 'gst' });

      const compiled = compileSql(recorder.where?.[0]);
      expect(compiled.sql).toMatch(/ilike/i);
      expect(compiled.sql).toContain('"title"');
      expect(compiled.sql).toContain('"description"');
      expect(compiled.sql).toContain('"external_key"');
      expect(compiled.sql).toContain('"name"'); // clients.name
      // Pattern is %gst% — should appear in params at least once.
      expect(compiled.params).toContain('%gst%');
    });

    it('applies the same WHERE shape to the COUNT query as the rows query', async () => {
      const { rowsRec, countRec } = stubSelectCapturingBoth([], 0);

      await service.list({
        filters: JSON.stringify([
          { field: 'status', operator: 'eq', value: 'pending' },
        ]),
        search: 'gst',
      });

      const rowsWhere = compileSql(rowsRec.where?.[0]);
      const countWhere = compileSql(countRec.where?.[0]);
      expect(countWhere.sql).toBe(rowsWhere.sql);
      expect(countWhere.params).toEqual(rowsWhere.params);
    });

    it('treats blank search as no predicate (no ILIKE rendered)', async () => {
      const recorder = stubSelectCapturing([], 0);

      await service.list({ search: '   ' });

      const compiled = compileSql(recorder.where?.[0]);
      expect(compiled.sql).not.toMatch(/ilike/i);
    });
  });
});
