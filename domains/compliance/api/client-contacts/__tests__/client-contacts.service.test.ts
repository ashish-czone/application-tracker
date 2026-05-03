import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ClientContactsService } from '../client-contacts.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockSelectReturning(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockUpdateWhere(returningRows: unknown[] = []) {
  const chain: AnyChain = {} as AnyChain;
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(returningRows);
  return chain;
}

interface TxMock {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

/**
 * After the camp-B move to composition over inheritance, the constructor
 * signature is `(crud, database, events, dataAccessScope)`. setPrimary /
 * hasPrimaryContact use `database` + `events` directly (the partial-unique-
 * index-aware transaction has to live below the BaseCrudService line) so the
 * `crud` mock here is a stub — those tests don't exercise it.
 */
function makeCrudMock() {
  return {
    list: vi.fn(),
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
}

function makeScopeMock() {
  return { buildPredicate: vi.fn().mockResolvedValue(undefined) };
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

describe('ClientContactsService', () => {
  let db: { db: { transaction: ReturnType<typeof vi.fn> } };
  let events: { emitDynamic: ReturnType<typeof vi.fn> };
  let crud: ReturnType<typeof makeCrudMock>;
  let scope: ReturnType<typeof makeScopeMock>;
  let service: ClientContactsService;

  beforeEach(() => {
    db = { db: { transaction: vi.fn() } };
    events = { emitDynamic: vi.fn() };
    crud = makeCrudMock();
    scope = makeScopeMock();
    service = new ClientContactsService(crud as never, db as never, events as never, scope as never);
  });

  describe('setPrimary', () => {
    it('unsets existing primary and sets new primary in one transaction', async () => {
      const existing = { id: 'ct-2', complianceClientId: 'cid-1', fullName: 'Bob', complianceIsPrimary: false };
      const demotedRow = { id: 'ct-1', complianceClientId: 'cid-1', fullName: 'Alice', complianceIsPrimary: false };
      const promotedRow = { ...existing, complianceIsPrimary: true };

      const selectChain = mockSelectReturning([existing]);
      const unsetChain = mockUpdateWhere([demotedRow]);
      const setChain = mockUpdateWhere([promotedRow]);

      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValueOnce(unsetChain).mockReturnValueOnce(setChain),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.setPrimary('cid-1', 'ct-2', 'user-1');

      expect(db.db.transaction).toHaveBeenCalledTimes(1);
      expect(tx.update).toHaveBeenCalledTimes(2);
      expect(unsetChain.set).toHaveBeenCalledWith({ complianceIsPrimary: false });
      expect(setChain.set).toHaveBeenCalledWith({ complianceIsPrimary: true });

      expect(events.emitDynamic).toHaveBeenCalledTimes(2);
      expect(events.emitDynamic).toHaveBeenCalledWith('client-contacts.Updated', expect.objectContaining({
        entityId: 'ct-1',
        actorId: 'user-1',
      }));
      expect(events.emitDynamic).toHaveBeenCalledWith('client-contacts.Updated', expect.objectContaining({
        entityId: 'ct-2',
        actorId: 'user-1',
      }));
    });

    it('no-ops when target contact is already primary', async () => {
      const selectChain = mockSelectReturning([
        { id: 'ct-1', complianceClientId: 'cid-1', fullName: 'Alice', complianceIsPrimary: true },
      ]);
      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.setPrimary('cid-1', 'ct-1');

      expect(tx.update).not.toHaveBeenCalled();
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('throws NotFound when contact does not exist', async () => {
      const selectChain = mockSelectReturning([]);
      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await expect(service.setPrimary('cid-1', 'ct-missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('emits nothing when the primary flip fails mid-transaction', async () => {
      const existing = { id: 'ct-2', complianceClientId: 'cid-1', fullName: 'Bob', complianceIsPrimary: false };
      const selectChain = mockSelectReturning([existing]);
      const unsetChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(new Error('db error')),
      } as unknown as AnyChain;
      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValueOnce(unsetChain),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await expect(service.setPrimary('cid-1', 'ct-2')).rejects.toThrow('db error');
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('throws NotFound when contact belongs to a different client', async () => {
      // The where clause scopes on both id AND clientId, so a contact belonging
      // to another client will not be returned by the select above.
      const selectChain = mockSelectReturning([]);
      const tx: TxMock = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await expect(service.setPrimary('cid-1', 'ct-from-other-client')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('hasPrimaryContact', () => {
    it('returns true when a primary contact exists', async () => {
      const whereChain = { limit: vi.fn().mockResolvedValue([{ id: 'ct-1' }]) };
      const fromChain = { where: vi.fn().mockReturnValue(whereChain) };
      const selectChain = { from: vi.fn().mockReturnValue(fromChain) };
      const dbMock = { select: vi.fn().mockReturnValue(selectChain) };
      const s = new ClientContactsService(
        makeCrudMock() as never,
        { db: dbMock } as never,
        events as never,
        makeScopeMock() as never,
      );

      await expect(s.hasPrimaryContact('cid-1')).resolves.toBe(true);
    });

    it('returns false when no primary contact exists', async () => {
      const whereChain = { limit: vi.fn().mockResolvedValue([]) };
      const fromChain = { where: vi.fn().mockReturnValue(whereChain) };
      const selectChain = { from: vi.fn().mockReturnValue(fromChain) };
      const dbMock = { select: vi.fn().mockReturnValue(selectChain) };
      const s = new ClientContactsService(
        makeCrudMock() as never,
        { db: dbMock } as never,
        events as never,
        makeScopeMock() as never,
      );

      await expect(s.hasPrimaryContact('cid-1')).resolves.toBe(false);
    });
  });
});

describe('ClientContactsService.list — server-side filters / sort / search / count', () => {
  let crud: ReturnType<typeof makeCrudMock>;
  let database: { db: { select: ReturnType<typeof vi.fn> } };
  let events: { emitDynamic: ReturnType<typeof vi.fn> };
  let scope: ReturnType<typeof makeScopeMock>;
  let service: ClientContactsService;

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
    crud = makeCrudMock();
    database = { db: { select: vi.fn() } };
    events = { emitDynamic: vi.fn() };
    scope = makeScopeMock();
    service = new ClientContactsService(
      crud as never,
      database as never,
      events as never,
      scope as never,
    );
  });

  it('returns paginated data with meta.total computed from the SQL count() query', async () => {
    stubSelect([{ id: 'ct1' }], 47);
    const result = await service.list({ page: 2, limit: 20, includeDeleted: false });
    expect(result.data).toEqual([{ id: 'ct1' }]);
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

  it('translates filters JSON eq predicate into a WHERE that pins complianceClientId', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'complianceClientId', operator: 'eq', value: 'cid-1' },
      ]),
    });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toContain('"compliance_client_id"');
    expect(compiled.params).toContain('cid-1');
  });

  it('honors bare passthrough id filter (?complianceClientId=cid-1) — the client detail page primary access pattern', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, complianceClientId: 'cid-1' });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toContain('"compliance_client_id"');
    expect(compiled.params).toContain('cid-1');
  });

  it('ignores unknown filter fields (whitelist enforced) without 400-ing', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'mysteryField', operator: 'eq', value: 'whatever' },
        { field: 'complianceClientId', operator: 'eq', value: 'cid-1' },
      ]),
    });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).not.toContain('mystery');
    expect(compiled.sql).toContain('"compliance_client_id"');
    expect(compiled.params).toContain('cid-1');
  });

  it('OR-composes ILIKE across fullName, primaryEmail, primaryPhone, jobTitle when search is provided', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, search: 'alice' });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).toMatch(/ilike/i);
    expect(compiled.sql).toContain('"full_name"');
    expect(compiled.sql).toContain('"primary_email"');
    expect(compiled.sql).toContain('"primary_phone"');
    expect(compiled.sql).toContain('"job_title"');
    expect(compiled.params).toContain('%alice%');
  });

  it('treats blank search as a no-op (no ILIKE rendered)', async () => {
    const recorder = stubSelectCapturing([], 0);
    // Pin a benign filter so the WHERE has at least one predicate to compile.
    await service.list({
      includeDeleted: false,
      search: '   ',
      filters: JSON.stringify([
        { field: 'complianceClientId', operator: 'eq', value: 'cid-1' },
      ]),
    });
    const compiled = compileSql(recorder.where?.[0]);
    expect(compiled.sql).not.toMatch(/ilike/i);
  });

  it('renders ORDER BY against the sort whitelist with stable id tiebreaker', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, sort: 'fullName', order: 'desc' });
    const orderBy = recorder.orderBy ?? [];
    expect(orderBy.length).toBe(2);
    const primary = compileSql(orderBy[0]);
    const tiebreaker = compileSql(orderBy[1]);
    expect(primary.sql).toContain('"full_name"');
    expect(primary.sql).toMatch(/desc/i);
    expect(tiebreaker.sql).toContain('"id"');
    expect(tiebreaker.sql).toMatch(/asc/i);
  });

  it('falls back to the default sort (fullName ASC) when sort key is unknown', async () => {
    const recorder = stubSelectCapturing([], 0);
    await service.list({ includeDeleted: false, sort: 'someUnknownField' });
    const primary = compileSql((recorder.orderBy ?? [])[0]);
    expect(primary.sql).toContain('"full_name"');
    expect(primary.sql).toMatch(/asc/i);
  });

  it('applies the same WHERE shape to the rows query and the count query', async () => {
    const { rowsRec, countRec } = stubSelectCapturingBoth([], 0);
    await service.list({
      includeDeleted: false,
      filters: JSON.stringify([
        { field: 'complianceClientId', operator: 'eq', value: 'cid-1' },
      ]),
      search: 'alice',
    });
    const rowsWhere = compileSql(rowsRec.where?.[0]);
    const countWhere = compileSql(countRec.where?.[0]);
    expect(countWhere.sql).toBe(rowsWhere.sql);
    expect(countWhere.params).toEqual(rowsWhere.params);
  });

  it('skips buildPredicate when no accessCtx is supplied', async () => {
    stubSelect([], 0);
    await service.list({ includeDeleted: false });
    expect(scope.buildPredicate).not.toHaveBeenCalled();
  });

  it('calls buildPredicate with CLIENT_CONTACTS_ANCHORS when accessCtx is provided', async () => {
    stubSelect([], 0);
    const accessCtx = { userId: 'u-1', scopes: ['any'] } as never;
    await service.list({ includeDeleted: false }, accessCtx);
    expect(scope.buildPredicate).toHaveBeenCalledTimes(1);
    expect(scope.buildPredicate).toHaveBeenCalledWith(
      accessCtx,
      expect.objectContaining({
        anchors: expect.objectContaining({ creator: expect.anything() }),
      }),
    );
  });
});
