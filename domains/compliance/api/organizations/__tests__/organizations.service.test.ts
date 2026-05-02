import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OrganizationsService } from '../organizations.service';

/**
 * Builds an OrganizationsService with:
 *   - a fake DatabaseService whose `db.select(...).from(...)` thenable
 *     resolves to `[{ count: <rowCount> }]` (the singleton-check path)
 *   - a fake `BaseCrudService` whose `create` returns the scripted row
 *
 * After the camp-B sprint switched to composition over inheritance, the
 * singleton check lives on `OrganizationsService.create` (which queries
 * the database directly) and the actual insert is delegated to the
 * injected `crud` instance. The test mocks both halves separately.
 */
function makeService(opts: { rowCount: number; inserted?: { id: string; name?: string } }) {
  const inserted = opts.inserted ?? { id: 'o1', name: 'Acme' };

  const proxy: Record<string, unknown> = {};
  const chainMethods = ['from', 'where', 'limit', 'offset'];
  for (const m of chainMethods) {
    proxy[m] = vi.fn().mockReturnValue(proxy);
  }
  proxy.select = vi.fn(() => proxy);
  proxy.then = (resolve: (v: unknown) => unknown) => resolve([{ count: opts.rowCount }]);

  const database = { db: proxy } as never;
  const crud = {
    list: vi.fn(),
    findOne: vi.fn(),
    findOneOrFail: vi.fn(),
    create: vi.fn().mockResolvedValue(inserted),
    update: vi.fn(),
    softDelete: vi.fn(),
  } as never;

  return new OrganizationsService(crud, database);
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
