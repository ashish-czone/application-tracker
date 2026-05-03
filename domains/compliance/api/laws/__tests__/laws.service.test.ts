import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { LawsService } from '../laws.service';

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

describe('LawsService.getOptions', () => {
  let crud: { findOneOrFail: ReturnType<typeof vi.fn> };
  let database: { db: { select: ReturnType<typeof vi.fn> } };
  let service: LawsService;

  function mockSelectChain(rows: unknown[]) {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    database.db.select = vi.fn().mockReturnValue(chain);
    return chain;
  }

  beforeEach(() => {
    crud = { findOneOrFail: vi.fn() };
    database = { db: { select: vi.fn() } };
    service = new LawsService(crud as never, database as never);
  });

  it('returns rows from the select chain limited to the requested limit', async () => {
    const chain = mockSelectChain([
      { id: 'l1', code: 'GST-101', name: 'GST Filing' },
      { id: 'l2', code: 'PF-200', name: 'PF Returns' },
    ]);
    const result = await service.getOptions({ limit: 25 });
    expect(result).toEqual([
      { id: 'l1', code: 'GST-101', name: 'GST Filing' },
      { id: 'l2', code: 'PF-200', name: 'PF Returns' },
    ]);
    expect(chain.limit).toHaveBeenCalledWith(25);
  });

  it('passes a where clause when search is provided', async () => {
    const chain = mockSelectChain([]);
    await service.getOptions({ limit: 25, search: 'gst' });
    expect(chain.where).toHaveBeenCalled();
  });

  it('hydrates labels by id when ids are provided (search is ignored)', async () => {
    const chain = mockSelectChain([{ id: 'l1', code: 'GST-101', name: 'GST Filing' }]);
    await service.getOptions({ limit: 25, ids: ['l1', 'l2'], search: 'gst' });
    expect(chain.where).toHaveBeenCalled();
  });
});

describe('LawsService.list — server-side filters / sort / search / count', () => {
  let crud: { findOneOrFail: ReturnType<typeof vi.fn> };
  let database: { db: { select: ReturnType<typeof vi.fn> } };
  let service: LawsService;

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
    service = new LawsService(crud as never, database as never);
  });

  it('returns paginated data with meta.total computed from the SQL count() query', async () => {
    stubSelect([{ id: 'l1' }], 47);
    const result = await service.list({ page: 2, limit: 20, includeDeleted: false });
    expect(result.data).toEqual([{ id: 'l1' }]);
    expect(result.meta).toEqual({
      page: 2,
      limit: 20,
      total: 47,
      totalPages: 3,
    });
  });

  it('clamps limit above 100 and computes totalPages from the clamped value', async () => {
    stubSelect([], 0);
    const result = await service.list({ page: 1, limit: 9999, includeDeleted: false });
    expect(result.meta).toEqual({
      page: 1,
      limit: 100,
      total: 0,
      totalPages: 1, // Math.max(1, Math.ceil(0/100))
    });
  });

  it('issues two database.db.select calls — the second is the count query', async () => {
    stubSelect([], 5);
    await service.list({ includeDeleted: false });
    expect(database.db.select).toHaveBeenCalledTimes(2);
    // The count query passes { total: count() } as the projection — the
    // first arg of the second select call should be an object with that key.
    const countProjection = database.db.select.mock.calls[1][0];
    expect(countProjection).toBeDefined();
    expect(Object.keys(countProjection)).toContain('total');
  });

  it('translates filters JSON eq predicate into a WHERE that pins the column', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'jurisdiction', operator: 'eq', value: 'central' },
      ]),
    });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toContain('"jurisdiction"');
    expect(compiled.params).toContain('central');
  });

  it('honors bare passthrough id filter (?jurisdiction=central)', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, jurisdiction: 'central' });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toContain('"jurisdiction"');
    expect(compiled.params).toContain('central');
  });

  it('ignores unknown filter fields (whitelist enforced) without 400-ing', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'mysteryField', operator: 'eq', value: 'whatever' },
        { field: 'jurisdiction', operator: 'eq', value: 'state' },
      ]),
    });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).not.toContain('mystery');
    expect(compiled.sql).toContain('"jurisdiction"');
    expect(compiled.params).toContain('state');
  });

  it('OR-composes ILIKE across code + name when search is provided', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, search: 'gst' });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toMatch(/ilike/i);
    expect(compiled.sql).toContain('"code"');
    expect(compiled.sql).toContain('"name"');
    expect(compiled.params).toContain('%gst%');
  });

  it('treats blank search as a no-op (no ILIKE rendered)', async () => {
    const recorder = stubSelectCapturing([], 0);
    // Pin a benign filter so the WHERE has at least one predicate; with
    // no filters at all and no soft-delete column on `compliance_laws`,
    // withScope returns undefined and the assertion has nothing to compile.
    await service.list({
      includeDeleted: false,
      search: '   ',
      filters: JSON.stringify([
        { field: 'jurisdiction', operator: 'eq', value: 'central' },
      ]),
    });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).not.toMatch(/ilike/i);
  });

  it('renders ORDER BY against the sort whitelist with stable id tiebreaker', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, sort: 'name', order: 'desc' });
    const orderBy = recorder.orderBy ?? [];
    expect(orderBy.length).toBe(2);
    const primary = compileSql(orderBy[0]);
    const tiebreaker = compileSql(orderBy[1]);
    expect(primary.sql).toContain('"name"');
    expect(primary.sql).toMatch(/desc/i);
    expect(tiebreaker.sql).toContain('"id"');
    expect(tiebreaker.sql).toMatch(/asc/i);
  });

  it('falls back to the default sort (code ASC) when sort key is unknown', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, sort: 'someUnknownField' });
    const primary = compileSql((recorder.orderBy ?? [])[0]);
    expect(primary.sql).toContain('"code"');
    expect(primary.sql).toMatch(/asc/i);
  });

  it('applies the same WHERE shape to the rows query and the count query', async () => {
    const { rowsRec, countRec } = stubSelectCapturingBoth([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'jurisdiction', operator: 'eq', value: 'central' },
      ]),
      search: 'gst',
    });
    const rowsWhere = compileSql(rowsRec.where?.[0]);
    const countWhere = compileSql(countRec.where?.[0]);
    expect(countWhere.sql).toBe(rowsWhere.sql);
    expect(countWhere.params).toEqual(rowsWhere.params);
  });
});
