import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { LawHandlersService } from '../law-handlers.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockInsertReturning(row: unknown) {
  const chain: AnyChain = {} as AnyChain;
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([row]);
  return chain;
}

function mockDeleteWhere() {
  const chain: AnyChain = {} as AnyChain;
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

function mockSelectCount(count: number) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue([{ count }]);
  return chain;
}

function mockSelectRows(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

/**
 * Helper for mocking a Drizzle query chain: every method call returns the
 * same proxy, and `await`-ing the chain resolves to the supplied value.
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
 * methods on the supplied `recorder` object so list-shape tests can assert
 * structurally on the WHERE / ORDER BY Drizzle SQL objects. Other methods
 * still chain through.
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

const dialect = new PgDialect();
function compileSql(sqlObj: unknown): { sql: string; params: unknown[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return dialect.sqlToQuery(sqlObj as any);
}

describe('LawHandlersService', () => {
  let db: { db: Record<string, ReturnType<typeof vi.fn>> };
  let service: LawHandlersService;

  beforeEach(() => {
    db = {
      db: {
        insert: vi.fn(),
        delete: vi.fn(),
        select: vi.fn(),
      },
    };
    // crud / LawsService / dataAccessScope aren't exercised by the
    // programmatic methods under test (createHandler / deleteHandler /
    // hasDefaultHandler / findByLaw).
    const crud = {} as never;
    const lawsService = {} as never;
    const dataAccessScope = {} as never;
    service = new LawHandlersService(crud, db as never, lawsService, dataAccessScope);
  });

  describe('createHandler', () => {
    it('inserts with defaults when isPrimary and clientId omitted', async () => {
      const insertChain = mockInsertReturning({
        id: 'h1',
        lawId: 'l1',
        orgEntityId: 'o1',
        clientId: null,
        isPrimary: false,
      });
      db.db.insert.mockReturnValue(insertChain);

      const result = await service.createHandler({ lawId: 'l1', orgEntityId: 'o1' });

      expect(insertChain.values).toHaveBeenCalledWith({
        lawId: 'l1',
        orgEntityId: 'o1',
        clientId: null,
        isPrimary: false,
      });
      expect(result.clientId).toBeNull();
      expect(result.isPrimary).toBe(false);
    });

    it('passes through clientId and isPrimary when provided', async () => {
      const insertChain = mockInsertReturning({
        id: 'h2',
        lawId: 'l1',
        orgEntityId: 'o1',
        clientId: 'c1',
        isPrimary: true,
      });
      db.db.insert.mockReturnValue(insertChain);

      await service.createHandler({ lawId: 'l1', orgEntityId: 'o1', clientId: 'c1', isPrimary: true });

      expect(insertChain.values).toHaveBeenCalledWith({
        lawId: 'l1',
        orgEntityId: 'o1',
        clientId: 'c1',
        isPrimary: true,
      });
    });
  });

  describe('deleteHandler', () => {
    it('calls delete with eq on id', async () => {
      const deleteChain = mockDeleteWhere();
      db.db.delete.mockReturnValue(deleteChain);

      await service.deleteHandler('h1');

      expect(db.db.delete).toHaveBeenCalledTimes(1);
      expect(deleteChain.where).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByLaw', () => {
    it('returns mapped rows for the given law', async () => {
      const selectChain = mockSelectRows([
        { id: 'h1', lawId: 'l1', orgEntityId: 'o1', clientId: null, isPrimary: true },
        { id: 'h2', lawId: 'l1', orgEntityId: 'o2', clientId: 'c1', isPrimary: false },
      ]);
      db.db.select.mockReturnValue(selectChain);

      const result = await service.findByLaw('l1');

      expect(result).toHaveLength(2);
      expect(result[0]?.isPrimary).toBe(true);
      expect(result[1]?.clientId).toBe('c1');
    });

    it('returns empty array when no handlers exist', async () => {
      db.db.select.mockReturnValue(mockSelectRows([]));
      expect(await service.findByLaw('l1')).toEqual([]);
    });
  });

  describe('hasDefaultHandler', () => {
    it('returns true when at least one global handler exists', async () => {
      db.db.select.mockReturnValue(mockSelectCount(2));
      expect(await service.hasDefaultHandler('l1')).toBe(true);
    });

    it('returns false when no global handler exists', async () => {
      db.db.select.mockReturnValue(mockSelectCount(0));
      expect(await service.hasDefaultHandler('l1')).toBe(false);
    });

    it('returns false when select returns empty rows', async () => {
      const chain: AnyChain = {} as AnyChain;
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockResolvedValue([]);
      db.db.select.mockReturnValue(chain);
      expect(await service.hasDefaultHandler('l1')).toBe(false);
    });
  });
});

describe('LawHandlersService.list — server-side filters / sort / search / count', () => {
  let crud: { findOneOrFail: ReturnType<typeof vi.fn> };
  let database: { db: { select: ReturnType<typeof vi.fn> } };
  let lawsService: { findDisplayByIds: ReturnType<typeof vi.fn> };
  let dataAccessScope: { buildPredicate: ReturnType<typeof vi.fn> };
  let service: LawHandlersService;

  /**
   * Stub the two `database.db.select` calls in `service.list`:
   * 1. rows query (returns `rows`)
   * 2. count query (returns `[{ total }]`)
   */
  function stubSelect(rows: unknown[], total: number) {
    database.db.select
      .mockReturnValueOnce(thenableChain(rows))
      .mockReturnValueOnce(thenableChain([{ total }]));
  }

  /**
   * Stub the rows query with a recording chain that captures `.where()` and
   * `.orderBy()`, and the count query with a plain thenable.
   */
  function stubSelectCapturing(rows: unknown[], total: number) {
    const recorder: Record<string, unknown[]> = {};
    database.db.select
      .mockReturnValueOnce(recordingChain(rows, recorder, ['where', 'orderBy', 'limit', 'offset']))
      .mockReturnValueOnce(thenableChain([{ total }]));
    return recorder;
  }

  /**
   * Variant that captures BOTH the rows-query WHERE and the count-query
   * WHERE so the test can assert they are structurally identical.
   */
  function stubSelectCapturingBoth(rows: unknown[], total: number) {
    const rowsRec: Record<string, unknown[]> = {};
    const countRec: Record<string, unknown[]> = {};
    database.db.select
      .mockReturnValueOnce(recordingChain(rows, rowsRec, ['where']))
      .mockReturnValueOnce(recordingChain([{ total }], countRec, ['where']));
    return { rowsRec, countRec };
  }

  beforeEach(() => {
    crud = { findOneOrFail: vi.fn() };
    database = { db: { select: vi.fn() } };
    lawsService = { findDisplayByIds: vi.fn().mockResolvedValue([]) };
    dataAccessScope = { buildPredicate: vi.fn().mockResolvedValue(undefined) };
    service = new LawHandlersService(
      crud as never,
      database as never,
      lawsService as never,
      dataAccessScope as never,
    );
  });

  it('returns paginated data with meta.total computed from the SQL count() query', async () => {
    stubSelect([], 47);
    const result = await service.list({ page: 2, limit: 20, includeDeleted: false } as never);
    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 47,
      totalPages: 3,
    });
  });

  it('clamps limit above 100 and computes totalPages from the clamped value', async () => {
    stubSelect([], 0);
    const result = await service.list({ page: 1, limit: 9999, includeDeleted: false } as never);
    expect(result.meta).toEqual({
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 1, // Math.max(1, Math.ceil(0/100))
    });
  });

  it('issues two database.db.select calls — the second is the count query', async () => {
    stubSelect([], 5);
    await service.list({ includeDeleted: false } as never);
    expect(database.db.select).toHaveBeenCalledTimes(2);
    // The count query passes { total: count() } as the projection — the
    // first arg of the second select call should be an object with that key.
    const countProjection = database.db.select.mock.calls[1][0];
    expect(countProjection).toBeDefined();
    expect(Object.keys(countProjection)).toContain('total');
  });

  it('translates filters JSON eq predicate on orgEntityId into a WHERE that pins the column', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'orgEntityId', operator: 'eq', value: 'org-unit-7' },
      ]),
    } as never);
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toContain('"org_entity_id"');
    expect(compiled.params).toContain('org-unit-7');
  });

  it('honors bare passthrough id filter ?orgEntityId=… (the bug PR-7 panel hit)', async () => {
    // This is the load-bearing assertion of the whole PR: the per-unit
    // panel sends `?orgEntityId=…` bare, and `BaseCrudService.list`
    // silently dropped it pre-fix, so handlers from ALL org units came
    // back. After the buildListQuery migration the column predicate
    // shows up in the WHERE.
    const recorder = stubSelectCapturing([], 0);
    await service.list({
      includeDeleted: false,
      orgEntityId: 'org-unit-7',
    } as never);
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toContain('"org_entity_id"');
    expect(compiled.params).toContain('org-unit-7');
  });

  it('honors bare passthrough id filter ?lawId=…', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, lawId: 'law-1' } as never);
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toContain('"law_id"');
    expect(compiled.params).toContain('law-1');
  });

  it('honors bare passthrough id filter ?clientId=…', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, clientId: 'client-1' } as never);
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toContain('"client_id"');
    expect(compiled.params).toContain('client-1');
  });

  it('ignores unknown filter fields (whitelist enforced) without 400-ing', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'mysteryField', operator: 'eq', value: 'whatever' },
        { field: 'orgEntityId', operator: 'eq', value: 'org-unit-7' },
      ]),
    } as never);
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).not.toContain('mystery');
    expect(compiled.sql).toContain('"org_entity_id"');
    expect(compiled.params).toContain('org-unit-7');
  });

  it('renders ORDER BY against the sort whitelist with stable id tiebreaker', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, sort: 'isPrimary', order: 'desc' } as never);
    const orderBy = recorder.orderBy ?? [];
    expect(orderBy.length).toBe(2);
    const primary = compileSql(orderBy[0]);
    const tiebreaker = compileSql(orderBy[1]);
    expect(primary.sql).toContain('"is_primary"');
    expect(primary.sql).toMatch(/desc/i);
    expect(tiebreaker.sql).toContain('"id"');
    expect(tiebreaker.sql).toMatch(/asc/i);
  });

  it('falls back to the default sort (createdAt DESC) when sort key is unknown', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, sort: 'someUnknownField' } as never);
    const primary = compileSql((recorder.orderBy ?? [])[0]);
    expect(primary.sql).toContain('"created_at"');
    expect(primary.sql).toMatch(/desc/i);
  });

  it('applies the same WHERE shape to the rows query and the count query', async () => {
    const { rowsRec, countRec } = stubSelectCapturingBoth([], 0);
    await service.list({
      includeDeleted: false,
      orgEntityId: 'org-unit-7',
    } as never);
    const rowsWhere = compileSql(rowsRec.where?.[0]);
    const countWhere = compileSql(countRec.where?.[0]);
    expect(countWhere.sql).toBe(rowsWhere.sql);
    expect(countWhere.params).toEqual(rowsWhere.params);
  });

  it('post-processes rows to embed lawCode/lawName/lawJurisdiction via service composition', async () => {
    // First select call returns rows; second returns count; lawsService
    // hydrates the display fields per row.
    database.db.select
      .mockReturnValueOnce(thenableChain([
        { id: 'h1', lawId: 'l1', orgEntityId: 'o1', clientId: null, isPrimary: true },
        { id: 'h2', lawId: 'l2', orgEntityId: 'o1', clientId: 'c1', isPrimary: false },
      ]))
      .mockReturnValueOnce(thenableChain([{ total: 2 }]));
    lawsService.findDisplayByIds.mockResolvedValue([
      { id: 'l1', code: 'GST-101', name: 'GST Filing', jurisdiction: 'central' },
      { id: 'l2', code: 'PF-200', name: 'PF Returns', jurisdiction: 'central' },
    ]);

    const result = await service.list({ includeDeleted: false, orgEntityId: 'o1' } as never);

    expect(lawsService.findDisplayByIds).toHaveBeenCalledTimes(1);
    // Sets are unordered; assert by content
    const calledWith = lawsService.findDisplayByIds.mock.calls[0][0] as string[];
    expect(new Set(calledWith)).toEqual(new Set(['l1', 'l2']));

    expect(result.data).toEqual([
      {
        id: 'h1',
        lawId: 'l1',
        orgEntityId: 'o1',
        clientId: null,
        isPrimary: true,
        lawCode: 'GST-101',
        lawName: 'GST Filing',
        lawJurisdiction: 'central',
      },
      {
        id: 'h2',
        lawId: 'l2',
        orgEntityId: 'o1',
        clientId: 'c1',
        isPrimary: false,
        lawCode: 'PF-200',
        lawName: 'PF Returns',
        lawJurisdiction: 'central',
      },
    ]);
  });

  it('skips the lawsService composition round-trip when the page is empty', async () => {
    stubSelect([], 0);
    const result = await service.list({ includeDeleted: false } as never);
    expect(lawsService.findDisplayByIds).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
  });

  it('builds the actor-scope predicate via DataAccessScopeService when accessCtx is supplied', async () => {
    stubSelect([], 0);
    const ctx = { userId: 'u1', permissions: {} } as never;
    await service.list({ includeDeleted: false } as never, ctx);
    expect(dataAccessScope.buildPredicate).toHaveBeenCalledTimes(1);
    expect(dataAccessScope.buildPredicate.mock.calls[0][0]).toBe(ctx);
  });

  it('skips the actor-scope buildPredicate call when no accessCtx is supplied', async () => {
    stubSelect([], 0);
    await service.list({ includeDeleted: false } as never);
    expect(dataAccessScope.buildPredicate).not.toHaveBeenCalled();
  });
});
