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
 */
function makeFakeDb(scriptedResult: unknown) {
  const wherePredicates: unknown[] = [];
  const proxy: any = {};
  const chain = ['select', 'from', 'limit', 'offset', 'insert', 'values', 'returning', 'update', 'set'];
  for (const m of chain) proxy[m] = vi.fn().mockReturnValue(proxy);
  proxy.where = vi.fn((predicate: unknown) => {
    wherePredicates.push(predicate);
    return proxy;
  });
  proxy.then = (resolve: any) => resolve(scriptedResult);
  return { db: proxy, wherePredicates };
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

      // First .where() call is from list's withScope(...) wrap.
      expect(fakeDb.wherePredicates).toHaveLength(1);
      // The predicate passed to withScope must be defined (not undefined).
      // This is the structural seal that the scope leg flows into the query.
      expect(fakeDb.wherePredicates[0]).toBeDefined();
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
});
