import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TasksService } from '../tasks.service';

function makeDb(rows: { id: string }[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });
  return { db: { select: selectFn } } as never;
}

describe('TasksService', () => {
  let entityService: {
    list: ReturnType<typeof vi.fn>;
    findOneOrFail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    clone: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    getListLayout: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    entityService = {
      list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      findOneOrFail: vi.fn().mockResolvedValue({ id: 't1' }),
      create: vi.fn().mockResolvedValue({ id: 't1' }),
      update: vi.fn().mockResolvedValue({ id: 't1' }),
      softDelete: vi.fn().mockResolvedValue(undefined),
      clone: vi.fn().mockResolvedValue({ id: 't2' }),
      restore: vi.fn().mockResolvedValue({ id: 't1' }),
      getListLayout: vi.fn().mockResolvedValue({ columns: [] }),
    };
  });

  describe('CRUD delegates', () => {
    it('list forwards query + accessCtx to entityService', async () => {
      const service = new TasksService(entityService as never, makeDb([]));
      const ctx = { userId: 'u1' } as never;
      await service.list({ page: 1 } as never, ctx);
      expect(entityService.list).toHaveBeenCalledWith({ page: 1 }, ctx);
    });

    it('findOne forwards id + accessCtx', async () => {
      const service = new TasksService(entityService as never, makeDb([]));
      await service.findOne('t1', { userId: 'u1' } as never);
      expect(entityService.findOneOrFail).toHaveBeenCalledWith('t1', { userId: 'u1' });
    });

    it('create forwards input + actorId', async () => {
      const service = new TasksService(entityService as never, makeDb([]));
      await service.create({ title: 'x' } as never, 'actor-1');
      expect(entityService.create).toHaveBeenCalledWith({ title: 'x' }, 'actor-1');
    });

    it('update forwards id + input + actorId + accessCtx', async () => {
      const service = new TasksService(entityService as never, makeDb([]));
      await service.update('t1', { title: 'x' } as never, 'actor-1', { userId: 'u1' } as never);
      expect(entityService.update).toHaveBeenCalledWith('t1', { title: 'x' }, 'actor-1', { userId: 'u1' });
    });

    it('softDelete forwards id + actorId + accessCtx', async () => {
      const service = new TasksService(entityService as never, makeDb([]));
      await service.softDelete('t1', 'actor-1', { userId: 'u1' } as never);
      expect(entityService.softDelete).toHaveBeenCalledWith('t1', 'actor-1', { userId: 'u1' });
    });

    it('clone forwards id + actorId', async () => {
      const service = new TasksService(entityService as never, makeDb([]));
      await service.clone('t1', 'actor-1');
      expect(entityService.clone).toHaveBeenCalledWith('t1', 'actor-1');
    });

    it('restore forwards id', async () => {
      const service = new TasksService(entityService as never, makeDb([]));
      await service.restore('t1');
      expect(entityService.restore).toHaveBeenCalledWith('t1');
    });

    it('getListLayout forwards to entityService', async () => {
      const service = new TasksService(entityService as never, makeDb([]));
      await service.getListLayout();
      expect(entityService.getListLayout).toHaveBeenCalled();
    });
  });

  describe('findByExternalKey', () => {
    it('returns matching row when one exists', async () => {
      const service = new TasksService(entityService as never, makeDb([{ id: 't1' }]));
      const result = await service.findByExternalKey('orders', 'ext-42');
      expect(result).toEqual({ id: 't1' });
    });

    it('returns null when no row matches', async () => {
      const service = new TasksService(entityService as never, makeDb([]));
      const result = await service.findByExternalKey('orders', 'ext-42');
      expect(result).toBeNull();
    });
  });
});
