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
      const service = new TasksService(entityService as never, makeDb([]), {} as never);
      const ctx = { userId: 'u1' } as never;
      await service.list({ page: 1 } as never, ctx);
      expect(entityService.list).toHaveBeenCalledWith({ page: 1 }, ctx);
    });

    it('findOne forwards id + accessCtx', async () => {
      const service = new TasksService(entityService as never, makeDb([]), {} as never);
      await service.findOne('t1', { userId: 'u1' } as never);
      expect(entityService.findOneOrFail).toHaveBeenCalledWith('t1', { userId: 'u1' });
    });

    it('create forwards input + actorId', async () => {
      const service = new TasksService(entityService as never, makeDb([]), {} as never);
      await service.create({ title: 'x' } as never, 'actor-1');
      expect(entityService.create).toHaveBeenCalledWith({ title: 'x' }, 'actor-1');
    });

    it('update forwards id + input + actorId + accessCtx', async () => {
      const service = new TasksService(entityService as never, makeDb([]), {} as never);
      await service.update('t1', { title: 'x' } as never, 'actor-1', { userId: 'u1' } as never);
      expect(entityService.update).toHaveBeenCalledWith('t1', { title: 'x' }, 'actor-1', { userId: 'u1' });
    });

    it('softDelete forwards id + actorId + accessCtx', async () => {
      const service = new TasksService(entityService as never, makeDb([]), {} as never);
      await service.softDelete('t1', 'actor-1', { userId: 'u1' } as never);
      expect(entityService.softDelete).toHaveBeenCalledWith('t1', 'actor-1', { userId: 'u1' });
    });

    it('clone forwards id + actorId', async () => {
      const service = new TasksService(entityService as never, makeDb([]), {} as never);
      await service.clone('t1', 'actor-1');
      expect(entityService.clone).toHaveBeenCalledWith('t1', 'actor-1');
    });

    it('restore forwards id', async () => {
      const service = new TasksService(entityService as never, makeDb([]), {} as never);
      await service.restore('t1');
      expect(entityService.restore).toHaveBeenCalledWith('t1');
    });

    it('getListLayout forwards to entityService', async () => {
      const service = new TasksService(entityService as never, makeDb([]), {} as never);
      await service.getListLayout();
      expect(entityService.getListLayout).toHaveBeenCalled();
    });
  });

  describe('findByExternalKey', () => {
    it('returns matching row when one exists', async () => {
      const service = new TasksService(entityService as never, makeDb([{ id: 't1' }]), {} as never);
      const result = await service.findByExternalKey('orders', 'ext-42');
      expect(result).toEqual({ id: 't1' });
    });

    it('returns null when no row matches', async () => {
      const service = new TasksService(entityService as never, makeDb([]), {} as never);
      const result = await service.findByExternalKey('orders', 'ext-42');
      expect(result).toBeNull();
    });
  });

  describe('handleUserDeactivated', () => {
    function makeUpdateDb(returnedRows: { id: string }[]) {
      const returningFn = vi.fn().mockResolvedValue(returnedRows);
      const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
      const setFn = vi.fn().mockReturnValue({ where: whereFn });
      const updateFn = vi.fn().mockReturnValue({ set: setFn });
      return { db: { update: updateFn }, _set: setFn, _returning: returningFn } as never;
    }

    it('nulls assigneeId on open tasks and returns the cleared count', async () => {
      const db = makeUpdateDb([{ id: 't1' }, { id: 't2' }]);
      const service = new TasksService(entityService as never, db, {} as never);
      const result = await service.handleUserDeactivated('user-1');
      expect(result).toEqual({ clearedCount: 2 });
      expect((db as any)._set).toHaveBeenCalledWith({ assigneeId: null });
    });

    it('returns zero count when the user has no open tasks', async () => {
      const service = new TasksService(entityService as never, makeUpdateDb([]), {} as never);
      const result = await service.handleUserDeactivated('user-nobody');
      expect(result).toEqual({ clearedCount: 0 });
    });

    it('propagates DB errors (caller decides rollback behavior)', async () => {
      const returningFn = vi.fn().mockRejectedValue(new Error('boom'));
      const whereFn = vi.fn().mockReturnValue({ returning: returningFn });
      const setFn = vi.fn().mockReturnValue({ where: whereFn });
      const updateFn = vi.fn().mockReturnValue({ set: setFn });
      const service = new TasksService(entityService as never, { db: { update: updateFn } } as never, {} as never);
      await expect(service.handleUserDeactivated('user-1')).rejects.toThrow('boom');
    });
  });
});
