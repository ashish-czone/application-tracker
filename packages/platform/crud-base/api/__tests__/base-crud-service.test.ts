import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { BaseCrudService } from '../base-crud-service';
import type { DataAccessContext } from '@packages/rbac';

// Minimal test table to exercise the type signatures + emit calls.
const widgets = pgTable('widgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
});

/**
 * Build a fake DatabaseService that returns scripted rows. Each chained
 * Drizzle method (`.from`, `.where`, `.limit`, etc.) returns the same
 * proxy until awaited. `.where` records the predicate it was called with
 * so the scope-wiring tests can assert what was AND'd into the WHERE.
 *
 * Each `.select(...)` call records its projection argument (undefined for
 * the rows query, `{ total: count() }` shape for the count query) so the
 * count-query tests can assert structurally that a sibling count query
 * was issued. The proxy is a single thenable: awaiting it resolves to
 * `scriptedResult`. For tests that need different per-await results
 * (e.g. rows then count), override `proxy.then` after constructing.
 */
function makeFakeDb(scriptedResult: unknown) {
  const wherePredicates: unknown[] = [];
  const selectArgs: unknown[] = [];
  const proxy: any = {};
  const chain = ['from', 'limit', 'offset', 'insert', 'values', 'returning', 'update', 'set'];
  for (const m of chain) proxy[m] = vi.fn().mockReturnValue(proxy);
  proxy.select = vi.fn((arg?: unknown) => {
    selectArgs.push(arg);
    return proxy;
  });
  proxy.where = vi.fn((predicate: unknown) => {
    wherePredicates.push(predicate);
    return proxy;
  });
  proxy.then = (resolve: any) => resolve(scriptedResult);
  return { db: proxy, wherePredicates, selectArgs };
}

function makeService(
  fakeDb: ReturnType<typeof makeFakeDb>,
  events: { emitDynamic: ReturnType<typeof vi.fn> },
  appLogger: { forContext: ReturnType<typeof vi.fn> },
  opts: {
    eventNames?: { created?: string; updated?: string; deleted?: string };
    scopeService?: { buildPredicate: ReturnType<typeof vi.fn> };
    scope?: { anchors: Record<string, unknown>; inlineResolvers?: ReadonlyArray<unknown> };
  } = {},
) {
  const dataAccessScope = opts.scopeService ?? {
    buildPredicate: vi.fn().mockResolvedValue(undefined),
  };
  return {
    service: new BaseCrudService(
      widgets,
      { slug: 'widgets', events: opts.eventNames, scope: opts.scope as never },
      fakeDb as never,
      events as never,
      dataAccessScope as never,
      appLogger as never,
    ),
    dataAccessScope,
  };
}

describe('BaseCrudService', () => {
  let mockEvents: { emitDynamic: ReturnType<typeof vi.fn> };
  let mockLogger: { forContext: ReturnType<typeof vi.fn> };
  let logCalls: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockEvents = { emitDynamic: vi.fn() };
    logCalls = { log: vi.fn(), warn: vi.fn() };
    mockLogger = { forContext: vi.fn().mockReturnValue(logCalls) };
  });

  it('exposes the expected method shape', () => {
    const fakeDb = makeFakeDb([]);
    const { service } = makeService(fakeDb, mockEvents, mockLogger);
    expect(typeof service.list).toBe('function');
    expect(typeof service.findOne).toBe('function');
    expect(typeof service.findOneOrFail).toBe('function');
    expect(typeof service.create).toBe('function');
    expect(typeof service.update).toBe('function');
    expect(typeof service.softDelete).toBe('function');
  });

  it('list applies default + max limit clamping', async () => {
    const fakeDb = makeFakeDb([]);
    const { service } = makeService(fakeDb, mockEvents, mockLogger);

    const out1 = await service.list({});
    expect(out1.meta.limit).toBe(25); // default

    const out2 = await service.list({ limit: 10000 });
    expect(out2.meta.limit).toBe(100); // clamped to max

    const out3 = await service.list({ limit: 50 });
    expect(out3.meta.limit).toBe(50); // honored
  });

  it('findOne returns null when no row found', async () => {
    const fakeDb = makeFakeDb([]);
    const { service } = makeService(fakeDb, mockEvents, mockLogger);

    const result = await service.findOne('does-not-exist');
    expect(result).toBeNull();
  });

  it('findOne returns the row when present', async () => {
    const row = { id: 'w1', name: 'Widget 1', deletedAt: null, deletedBy: null };
    const fakeDb = makeFakeDb([row]);
    const { service } = makeService(fakeDb, mockEvents, mockLogger);

    const result = await service.findOne('w1');
    expect(result).toEqual(row);
  });

  it('findOneOrFail throws NotFoundException when no row found', async () => {
    const fakeDb = makeFakeDb([]);
    const { service } = makeService(fakeDb, mockEvents, mockLogger);

    await expect(service.findOneOrFail('w1')).rejects.toThrow(NotFoundException);
  });

  it('create emits the configured created event', async () => {
    const created = { id: 'w1', name: 'New' };
    const fakeDb = makeFakeDb([created]);
    const { service } = makeService(fakeDb, mockEvents, mockLogger, {
      eventNames: { created: 'widgets.Created' },
    });

    await service.create({ id: 'w1', name: 'New' } as never, 'user-1');

    expect(mockEvents.emitDynamic).toHaveBeenCalledWith(
      'widgets.Created',
      expect.objectContaining({
        entityType: 'widgets',
        entityId: 'w1',
        actorId: 'user-1',
      }),
    );
  });

  it('create does NOT emit when events.created is not configured', async () => {
    const fakeDb = makeFakeDb([{ id: 'w1', name: 'New' }]);
    const { service } = makeService(fakeDb, mockEvents, mockLogger, { eventNames: {} });

    await service.create({ id: 'w1', name: 'New' } as never, 'user-1');

    expect(mockEvents.emitDynamic).not.toHaveBeenCalled();
  });

  it('logger context binds to options.slug', () => {
    const fakeDb = makeFakeDb([]);
    makeService(fakeDb, mockEvents, mockLogger);
    expect(mockLogger.forContext).toHaveBeenCalledWith('BaseCrudService:widgets');
  });

  describe('actor-scope wiring', () => {
    const ANCHORS = { creator: widgets.createdBy };
    const ctx: DataAccessContext = { userId: 'user-1', scopes: [{ type: 'creator' }] };

    it('list does NOT call buildPredicate when no scope is configured', async () => {
      const fakeDb = makeFakeDb([]);
      const scopeService = { buildPredicate: vi.fn().mockResolvedValue(undefined) };
      const { service } = makeService(fakeDb, mockEvents, mockLogger, { scopeService });

      await service.list({}, ctx);

      expect(scopeService.buildPredicate).not.toHaveBeenCalled();
    });

    it('list does NOT call buildPredicate when accessCtx is omitted', async () => {
      const fakeDb = makeFakeDb([]);
      const scopeService = { buildPredicate: vi.fn().mockResolvedValue(undefined) };
      const { service } = makeService(fakeDb, mockEvents, mockLogger, {
        scopeService,
        scope: { anchors: ANCHORS },
      });

      await service.list({});

      expect(scopeService.buildPredicate).not.toHaveBeenCalled();
    });

    it('list calls buildPredicate with the registered scope shape and accessCtx', async () => {
      const fakeDb = makeFakeDb([]);
      const inlineResolvers = [{ key: 'custom', resolve: () => undefined }];
      const scopeService = { buildPredicate: vi.fn().mockResolvedValue(undefined) };
      const { service } = makeService(fakeDb, mockEvents, mockLogger, {
        scopeService,
        scope: { anchors: ANCHORS, inlineResolvers },
      });

      await service.list({}, ctx);

      expect(scopeService.buildPredicate).toHaveBeenCalledTimes(1);
      expect(scopeService.buildPredicate).toHaveBeenCalledWith(ctx, {
        anchors: ANCHORS,
        inlineResolvers,
      });
    });

    it('list ANDs the scope predicate into the WHERE when buildPredicate returns SQL', async () => {
      const fakeDb = makeFakeDb([]);
      const scopePredicate = sql`${widgets.createdBy} = ${'user-1'}`;
      const scopeService = { buildPredicate: vi.fn().mockResolvedValue(scopePredicate) };
      const { service } = makeService(fakeDb, mockEvents, mockLogger, {
        scopeService,
        scope: { anchors: ANCHORS },
      });

      await service.list({}, ctx);

      // Two .where() calls: one for the rows query, one for the count
      // query. Both must receive the SAME defined predicate so the
      // rendered page and the reported total can't drift.
      expect(fakeDb.wherePredicates).toHaveLength(2);
      expect(fakeDb.wherePredicates[0]).toBeDefined();
      expect(fakeDb.wherePredicates[1]).toBeDefined();
      expect(fakeDb.wherePredicates[0]).toBe(fakeDb.wherePredicates[1]);
    });

    it('findOne wires scope into the WHERE alongside the id predicate', async () => {
      const fakeDb = makeFakeDb([]);
      const scopePredicate = sql`${widgets.createdBy} = ${'user-1'}`;
      const scopeService = { buildPredicate: vi.fn().mockResolvedValue(scopePredicate) };
      const { service } = makeService(fakeDb, mockEvents, mockLogger, {
        scopeService,
        scope: { anchors: ANCHORS },
      });

      await service.findOne('w1', ctx);

      expect(scopeService.buildPredicate).toHaveBeenCalledTimes(1);
      expect(fakeDb.wherePredicates).toHaveLength(1);
      expect(fakeDb.wherePredicates[0]).toBeDefined();
    });

    it('update calls buildPredicate twice — once for the pre-read, once for the UPDATE WHERE', async () => {
      const before = { id: 'w1', name: 'Before', createdBy: 'user-1' };
      const after = { id: 'w1', name: 'After', createdBy: 'user-1' };
      // Pre-read returns [before]; UPDATE...returning() returns [after].
      // Our fake db is single-shot, so we script it to return after; the
      // pre-read goes through findOne which uses the same proxy. We just
      // verify buildPredicate is invoked twice — once per scope-aware step.
      const fakeDb = makeFakeDb([after]);
      // Make findOne return a non-null row by scripting [before] for the first
      // call. To keep the proxy simple, we override the .then resolver to
      // return [before] first then [after].
      let callCount = 0;
      fakeDb.db.then = (resolve: any) => {
        callCount += 1;
        return resolve(callCount === 1 ? [before] : [after]);
      };
      const scopePredicate = sql`${widgets.createdBy} = ${'user-1'}`;
      const scopeService = { buildPredicate: vi.fn().mockResolvedValue(scopePredicate) };
      const { service } = makeService(fakeDb, mockEvents, mockLogger, {
        scopeService,
        scope: { anchors: ANCHORS },
      });

      await service.update('w1', { name: 'After' } as never, 'user-1', ctx);

      expect(scopeService.buildPredicate).toHaveBeenCalledTimes(2);
    });

    it('softDelete calls buildPredicate twice — once for the pre-read, once for the UPDATE WHERE', async () => {
      const before = { id: 'w1', name: 'Before', createdBy: 'user-1' };
      const fakeDb = makeFakeDb([before]);
      const scopePredicate = sql`${widgets.createdBy} = ${'user-1'}`;
      const scopeService = { buildPredicate: vi.fn().mockResolvedValue(scopePredicate) };
      const { service } = makeService(fakeDb, mockEvents, mockLogger, {
        scopeService,
        scope: { anchors: ANCHORS },
      });

      await service.softDelete('w1', 'user-1', ctx);

      expect(scopeService.buildPredicate).toHaveBeenCalledTimes(2);
    });

    it('passes the predicate through unchanged when buildPredicate returns 1=0 (deny)', async () => {
      const fakeDb = makeFakeDb([]);
      const denyPredicate = sql`1=0`;
      const scopeService = { buildPredicate: vi.fn().mockResolvedValue(denyPredicate) };
      const { service } = makeService(fakeDb, mockEvents, mockLogger, {
        scopeService,
        scope: { anchors: ANCHORS },
      });

      const result = await service.list({}, ctx);

      // The deny predicate flows through; the fake DB returns []. In a real
      // DB, `1=0` short-circuits all rows. The contract here is that the
      // predicate was built and applied — the actual filtering is Postgres'
      // job and is exercised by integration tests against a real DB.
      expect(result.data).toEqual([]);
      expect(scopeService.buildPredicate).toHaveBeenCalledTimes(1);
    });
  });

  describe('list meta.total + totalPages', () => {
    /**
     * Build a fake db that returns one scripted result for the rows
     * query and another for the count query. The proxy is awaited
     * exactly twice per `list()` call — first for rows, then for count.
     */
    function makeListFakeDb(rowsResult: unknown, countResult: unknown) {
      const fakeDb = makeFakeDb(rowsResult);
      let awaitCount = 0;
      fakeDb.db.then = (resolve: (value: unknown) => unknown) => {
        awaitCount += 1;
        return resolve(awaitCount === 1 ? rowsResult : countResult);
      };
      return fakeDb;
    }

    it('meta.total comes from the SQL count() query, NOT rows.length', async () => {
      // Rows page returns 3 widgets (the page size). The full table has 47.
      const rowsPage = [
        { id: 'w1', name: 'A' },
        { id: 'w2', name: 'B' },
        { id: 'w3', name: 'C' },
      ];
      const countRow = [{ total: 47 }];
      const fakeDb = makeListFakeDb(rowsPage, countRow);
      const { service } = makeService(fakeDb, mockEvents, mockLogger);

      const result = await service.list({ page: 1, limit: 3 });

      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(47);
      expect(result.meta.total).not.toBe(result.data.length);
    });

    it('coerces a string total (Postgres count() returns bigint as string) to a number', async () => {
      const fakeDb = makeListFakeDb([], [{ total: '123' }]);
      const { service } = makeService(fakeDb, mockEvents, mockLogger);

      const result = await service.list({});

      expect(result.meta.total).toBe(123);
      expect(typeof result.meta.total).toBe('number');
    });

    it('falls back to total=0 when the count query returns no rows', async () => {
      const fakeDb = makeListFakeDb([], []);
      const { service } = makeService(fakeDb, mockEvents, mockLogger);

      const result = await service.list({});

      expect(result.meta.total).toBe(0);
    });

    it('issues the count query against the same WHERE as the rows query', async () => {
      const fakeDb = makeListFakeDb([], [{ total: 0 }]);
      const { service } = makeService(fakeDb, mockEvents, mockLogger);

      await service.list({});

      // Two .select() calls — one for rows, one for count.
      expect(fakeDb.selectArgs).toHaveLength(2);
      // First select has no projection arg (Drizzle's `db.select()`).
      expect(fakeDb.selectArgs[0]).toBeUndefined();
      // Second select projects `{ total: <SQL> }` — the count query.
      expect(fakeDb.selectArgs[1]).toBeDefined();
      expect(fakeDb.selectArgs[1]).toHaveProperty('total');

      // Two .where() calls; both receive the SAME predicate reference so
      // the rendered page and the reported total can't drift.
      expect(fakeDb.wherePredicates).toHaveLength(2);
      expect(fakeDb.wherePredicates[0]).toBe(fakeDb.wherePredicates[1]);
    });

    it('totalPages = ceil(total / limit)', async () => {
      const fakeDb = makeListFakeDb([], [{ total: 47 }]);
      const { service } = makeService(fakeDb, mockEvents, mockLogger);

      const result = await service.list({ page: 1, limit: 10 });

      expect(result.meta.total).toBe(47);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
    });

    it('totalPages floors at 1 even for empty result sets', async () => {
      const fakeDb = makeListFakeDb([], [{ total: 0 }]);
      const { service } = makeService(fakeDb, mockEvents, mockLogger);

      const result = await service.list({ limit: 25 });

      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(1);
    });

    it('totalPages is exactly 1 when total equals limit', async () => {
      const fakeDb = makeListFakeDb([], [{ total: 25 }]);
      const { service } = makeService(fakeDb, mockEvents, mockLogger);

      const result = await service.list({ limit: 25 });

      expect(result.meta.totalPages).toBe(1);
    });
  });
});
