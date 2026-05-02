import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { BaseCrudService } from '../base-crud-service';

// Minimal test table to exercise the type signatures + emit calls.
const widgets = pgTable('widgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
});

/**
 * Build a fake DatabaseService that returns scripted rows. Each chained
 * Drizzle method (`.from`, `.where`, `.limit`, etc.) returns the same
 * proxy until awaited.
 */
function makeFakeDb(scriptedResult: unknown) {
  const proxy: any = {};
  const chain = ['select', 'from', 'where', 'limit', 'offset', 'insert', 'values', 'returning', 'update', 'set'];
  for (const m of chain) proxy[m] = vi.fn().mockReturnValue(proxy);
  proxy.then = (resolve: any) => resolve(scriptedResult);
  return { db: proxy };
}

function makeService(
  scriptedDb: ReturnType<typeof makeFakeDb>,
  events: { emitDynamic: ReturnType<typeof vi.fn> },
  appLogger: { forContext: ReturnType<typeof vi.fn> },
  eventNames?: { created?: string; updated?: string; deleted?: string },
) {
  return new BaseCrudService(
    widgets,
    { slug: 'widgets', events: eventNames },
    scriptedDb as never,
    events as never,
    appLogger as never,
  );
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
    const svc = makeService(fakeDb, mockEvents, mockLogger);
    expect(typeof svc.list).toBe('function');
    expect(typeof svc.findOne).toBe('function');
    expect(typeof svc.findOneOrFail).toBe('function');
    expect(typeof svc.create).toBe('function');
    expect(typeof svc.update).toBe('function');
    expect(typeof svc.softDelete).toBe('function');
  });

  it('list applies default + max limit clamping', async () => {
    const fakeDb = makeFakeDb([]);
    const svc = makeService(fakeDb, mockEvents, mockLogger);

    const out1 = await svc.list({});
    expect(out1.meta.limit).toBe(25); // default

    const out2 = await svc.list({ limit: 10000 });
    expect(out2.meta.limit).toBe(100); // clamped to max

    const out3 = await svc.list({ limit: 50 });
    expect(out3.meta.limit).toBe(50); // honored
  });

  it('findOne returns null when no row found', async () => {
    const fakeDb = makeFakeDb([]);
    const svc = makeService(fakeDb, mockEvents, mockLogger);

    const result = await svc.findOne('does-not-exist');
    expect(result).toBeNull();
  });

  it('findOne returns the row when present', async () => {
    const row = { id: 'w1', name: 'Widget 1', deletedAt: null, deletedBy: null };
    const fakeDb = makeFakeDb([row]);
    const svc = makeService(fakeDb, mockEvents, mockLogger);

    const result = await svc.findOne('w1');
    expect(result).toEqual(row);
  });

  it('findOneOrFail throws NotFoundException when no row found', async () => {
    const fakeDb = makeFakeDb([]);
    const svc = makeService(fakeDb, mockEvents, mockLogger);

    await expect(svc.findOneOrFail('w1')).rejects.toThrow(NotFoundException);
  });

  it('create emits the configured created event', async () => {
    const created = { id: 'w1', name: 'New' };
    const fakeDb = makeFakeDb([created]);
    const svc = makeService(fakeDb, mockEvents, mockLogger, { created: 'widgets.Created' });

    await svc.create({ id: 'w1', name: 'New' } as never, 'user-1');

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
    const svc = makeService(fakeDb, mockEvents, mockLogger, {});

    await svc.create({ id: 'w1', name: 'New' } as never, 'user-1');

    expect(mockEvents.emitDynamic).not.toHaveBeenCalled();
  });

  it('logger context binds to options.slug', () => {
    const fakeDb = makeFakeDb([]);
    makeService(fakeDb, mockEvents, mockLogger);
    expect(mockLogger.forContext).toHaveBeenCalledWith('BaseCrudService:widgets');
  });
});
