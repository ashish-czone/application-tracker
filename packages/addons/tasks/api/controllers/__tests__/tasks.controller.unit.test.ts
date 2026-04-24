import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TasksController } from '../tasks.controller';
import type { TasksService } from '../../services/tasks.service';

describe('TasksController', () => {
  let service: {
    list: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    clone: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    getListLayout: ReturnType<typeof vi.fn>;
  };
  let controller: TasksController;

  beforeEach(() => {
    service = {
      list: vi.fn().mockResolvedValue({ data: [], meta: {} }),
      findOne: vi.fn().mockResolvedValue({ id: 't1' }),
      create: vi.fn().mockResolvedValue({ id: 't1' }),
      update: vi.fn().mockResolvedValue({ id: 't1' }),
      softDelete: vi.fn().mockResolvedValue(undefined),
      clone: vi.fn().mockResolvedValue({ id: 't2' }),
      restore: vi.fn().mockResolvedValue({ id: 't1' }),
      getListLayout: vi.fn().mockResolvedValue({ columns: [] }),
    };
    controller = new TasksController(service as unknown as TasksService);
  });

  it('list parses page/limit/includeDeleted', async () => {
    await controller.list({ page: '2', limit: '50', includeDeleted: 'true' });
    expect(service.list).toHaveBeenCalledWith(
      { page: 2, limit: 50, includeDeleted: true },
      undefined,
    );
  });

  it('findOne delegates with access context', async () => {
    const ctx = { userId: 'u1' } as never;
    await controller.findOne('t1', ctx);
    expect(service.findOne).toHaveBeenCalledWith('t1', ctx);
  });

  it('create parses body and forwards actor id', async () => {
    await controller.create(
      { title: 'Write tests', assigneeTeamId: '00000000-0000-0000-0000-000000000001', createdBy: 'user-1' },
      { userId: 'user-1' } as never,
    );
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Write tests' }),
      'user-1',
    );
  });

  it('update parses body and forwards actor id + access context', async () => {
    const ctx = { userId: 'u1' } as never;
    await controller.update('t1', { title: 'New title' }, { userId: 'user-1' } as never, ctx);
    expect(service.update).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'New title' }), 'user-1', ctx);
  });

  it('delete requires tasks.delete permission', () => {
    const permission = Reflect.getMetadata('requiredPermission', TasksController.prototype.delete);
    expect(permission).toBe('tasks.delete');
  });

  it('create requires tasks.create permission', () => {
    const permission = Reflect.getMetadata('requiredPermission', TasksController.prototype.create);
    expect(permission).toBe('tasks.create');
  });

  it('list requires tasks.read permission', () => {
    const permission = Reflect.getMetadata('requiredPermission', TasksController.prototype.list);
    expect(permission).toBe('tasks.read');
  });

  it('clone delegates to service', async () => {
    await controller.clone('t1', { userId: 'user-1' } as never);
    expect(service.clone).toHaveBeenCalledWith('t1', 'user-1');
  });

  it('restore delegates to service', async () => {
    await controller.restore('t1');
    expect(service.restore).toHaveBeenCalledWith('t1');
  });

  it('getListLayout delegates to service', async () => {
    await controller.getListLayout();
    expect(service.getListLayout).toHaveBeenCalled();
  });
});
