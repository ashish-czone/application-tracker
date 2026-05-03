import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { OrganizationsService } from '../organizations.service';

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

/**
 * Builds an OrganizationsService with explicit per-call select stubs. The
 * caller seeds `db.select` with the chains it needs (one per `db.select`
 * invocation in the method under test) via `db.select.mockReturnValueOnce`.
 *
 * After the camp-B sprint switched to composition over inheritance, the
 * singleton check lives on `OrganizationsService.create` (which queries
 * the database directly via `db.select({count}).from(organizations)`)
 * and the actual insert is delegated to the injected `crud` instance.
 * The list path issues TWO db.select calls (rows + count). The helper
 * returns the underlying mock so tests can wire up exactly the right
 * number of returnValueOnce calls.
 */
function makeService(opts: { inserted?: { id: string; name?: string } } = {}) {
  const inserted = opts.inserted ?? { id: 'o1', name: 'Acme' };

  const select = vi.fn();
  const database = { db: { select } } as never;
  const crud = {
    list: vi.fn(),
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    create: vi.fn().mockResolvedValue(inserted),
    update: vi.fn(),
    softDelete: vi.fn(),
  } as never;

  return { service: new OrganizationsService(crud, database), select, crud };
}

describe('OrganizationsService.create (singleton invariant)', () => {
  it('inserts the first organization when no row exists', async () => {
    const { service, select, crud } = makeService();
    select.mockReturnValueOnce(thenableChain([{ count: 0 }]));
    const result = await service.create({ name: 'Acme' } as never, 'actor-1');
    expect(result).toEqual({ id: 'o1', name: 'Acme' });
    expect(crud.create).toHaveBeenCalledWith({ name: 'Acme' }, 'actor-1');
  });

  it('throws BadRequestException when a row already exists', async () => {
    const { service, select } = makeService();
    select.mockReturnValueOnce(thenableChain([{ count: 1 }]));
    await expect(
      service.create({ name: 'Second' } as never, 'actor-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OrganizationsService.softDelete (hard-blocked)', () => {
  it('always throws BadRequestException — the organization cannot be deleted', async () => {
    const { service } = makeService();
    await expect(service.softDelete('o1', 'actor-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws regardless of access context', async () => {
    const { service } = makeService();
    await expect(
      service.softDelete('o1', 'actor-1', { userId: 'u1', scopes: [] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OrganizationsService.list — server-side filters / sort / search / count', () => {
  let service: OrganizationsService;
  let select: ReturnType<typeof vi.fn>;

  /**
   * Stub the two `database.db.select` calls in `service.list`:
   * 1. rows query (returns `rows`)
   * 2. count query (returns `[{ total }]`)
   */
  function stubSelect(rows: unknown[], total: number) {
    select
      .mockReturnValueOnce(thenableChain(rows))
      .mockReturnValueOnce(thenableChain([{ total }]));
  }

  /**
   * Stub the rows query with a recording chain that captures `.where()` and
   * `.orderBy()`, and the count query with a plain thenable.
   */
  function stubSelectCapturing(rows: unknown[], total: number) {
    const recorder: Record<string, unknown[]> = {};
    select
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
    select
      .mockReturnValueOnce(recordingChain(rows, rowsRec, ['where']))
      .mockReturnValueOnce(recordingChain([{ total }], countRec, ['where']));
    return { rowsRec, countRec };
  }

  beforeEach(() => {
    const built = makeService();
    service = built.service;
    select = built.select;
  });

  it('returns the singleton row with meta.total = 1 from the SQL count() query', async () => {
    stubSelect([{ id: 'o1', name: 'Acme' }], 1);
    const result = await service.list({ includeDeleted: false } as never);
    expect(result.data).toEqual([{ id: 'o1', name: 'Acme' }]);
    expect(result.meta).toEqual({
      page: 1,
      limit: 25,
      total: 1,
      totalPages: 1,
    });
  });

  it('issues two database.db.select calls — the second is the count query with count() projection', async () => {
    stubSelect([{ id: 'o1' }], 1);
    await service.list({ includeDeleted: false } as never);
    expect(select).toHaveBeenCalledTimes(2);
    // The count query passes { total: count() } as the projection — the
    // first arg of the second select call should be an object with that key.
    const countProjection = select.mock.calls[1][0];
    expect(countProjection).toBeDefined();
    expect(Object.keys(countProjection)).toContain('total');
  });

  it('reports meta.total = 0 with totalPages = 1 when no row exists yet (pre-seed)', async () => {
    stubSelect([], 0);
    const result = await service.list({ includeDeleted: false } as never);
    expect(result.data).toEqual([]);
    expect(result.meta).toEqual({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 1,
    });
  });

  it('honors bare passthrough id filter (?id=…)', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, id: 'org-uuid-1' } as never);
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toContain('"id"');
    expect(compiled.params).toContain('org-uuid-1');
  });

  it('ignores unknown filter fields (whitelist enforced) without 400-ing', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'mysteryField', operator: 'eq', value: 'whatever' },
        { field: 'name', operator: 'eq', value: 'Acme' },
      ]),
    } as never);
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).not.toContain('mystery');
    expect(compiled.sql).toContain('"name"');
    expect(compiled.params).toContain('Acme');
  });

  it('renders ORDER BY against the sort whitelist with stable id tiebreaker', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, sort: 'createdAt', order: 'desc' } as never);
    const orderBy = recorder.orderBy ?? [];
    expect(orderBy.length).toBe(2);
    const primary = compileSql(orderBy[0]);
    const tiebreaker = compileSql(orderBy[1]);
    expect(primary.sql).toContain('"created_at"');
    expect(primary.sql).toMatch(/desc/i);
    expect(tiebreaker.sql).toContain('"id"');
    expect(tiebreaker.sql).toMatch(/asc/i);
  });

  it('falls back to the default sort (name ASC) when sort key is unknown', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, sort: 'someUnknownField' } as never);
    const primary = compileSql((recorder.orderBy ?? [])[0]);
    expect(primary.sql).toContain('"name"');
    expect(primary.sql).toMatch(/asc/i);
  });

  it('applies the same WHERE shape to the rows query and the count query', async () => {
    const { rowsRec, countRec } = stubSelectCapturingBoth([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'name', operator: 'eq', value: 'Acme' },
      ]),
    } as never);
    const rowsWhere = compileSql(rowsRec.where?.[0]);
    const countWhere = compileSql(countRec.where?.[0]);
    expect(countWhere.sql).toBe(rowsWhere.sql);
    expect(countWhere.params).toEqual(rowsWhere.params);
  });
});
