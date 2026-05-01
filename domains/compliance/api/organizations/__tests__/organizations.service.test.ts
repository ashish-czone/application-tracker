import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OrganizationsService } from '../organizations.service';

/**
 * Builds an OrganizationsService with a fake DatabaseService whose chain
 * responds based on which top-level method was called first:
 *   - `db.select(...)` (singleton-check path) → resolves to `[{ count: <rowCount> }]`
 *   - `db.insert(...)` (BaseCrudService.create path) → resolves to `[{ id: 'o1', ... }]`
 *
 * The thenable proxy short-circuits the chain so any sequence of `.from()`,
 * `.values()`, `.returning()`, etc. resolves to the scripted result on
 * `await`.
 */
function makeService(opts: { rowCount: number; inserted?: { id: string; name?: string } }) {
  const inserted = opts.inserted ?? { id: 'o1', name: 'Acme' };
  let pendingOp: 'select' | 'insert' | 'update' | 'unknown' = 'unknown';

  const proxy: Record<string, unknown> = {};
  const chainMethods = ['from', 'where', 'limit', 'offset', 'values', 'returning', 'set'];
  for (const m of chainMethods) {
    proxy[m] = vi.fn().mockReturnValue(proxy);
  }
  proxy.select = vi.fn(() => {
    pendingOp = 'select';
    return proxy;
  });
  proxy.insert = vi.fn(() => {
    pendingOp = 'insert';
    return proxy;
  });
  proxy.update = vi.fn(() => {
    pendingOp = 'update';
    return proxy;
  });
  proxy.then = (resolve: (v: unknown) => unknown) => {
    if (pendingOp === 'select') return resolve([{ count: opts.rowCount }]);
    if (pendingOp === 'insert') return resolve([inserted]);
    return resolve([]);
  };

  const database = { db: proxy } as never;
  const events = { emitDynamic: vi.fn() } as never;
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const appLogger = { forContext: vi.fn().mockReturnValue(logger) } as never;

  return new OrganizationsService(database, events, appLogger);
}

describe('OrganizationsService', () => {
  describe('create (singleton invariant)', () => {
    it('inserts the first organization when no row exists', async () => {
      const service = makeService({ rowCount: 0 });
      const result = await service.create({ name: 'Acme' } as never, 'actor-1');
      expect(result).toEqual({ id: 'o1', name: 'Acme' });
    });

    it('throws BadRequestException when a row already exists', async () => {
      const service = makeService({ rowCount: 1 });
      await expect(
        service.create({ name: 'Second' } as never, 'actor-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('softDelete (hard-blocked)', () => {
    it('always throws BadRequestException — the organization cannot be deleted', async () => {
      const service = makeService({ rowCount: 1 });
      await expect(service.softDelete('o1', 'actor-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws regardless of access context', async () => {
      const service = makeService({ rowCount: 0 });
      await expect(
        service.softDelete('o1', 'actor-1', { userId: 'u1', scopes: [] } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
