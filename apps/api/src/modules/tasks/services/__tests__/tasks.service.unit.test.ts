import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TasksService } from '../tasks.service';

function createMockChain() {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockResolvedValue([]);
  chain.returning = vi.fn().mockResolvedValue([]);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  return chain;
}

function createMockDb() {
  const chain = createMockChain();
  return {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(chain) }),
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    delete: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

const mockTask = {
  id: 'task-1',
  title: 'Test Task',
  description: 'A test task',
  status: 'open',
  priority: 'medium',
  assigneeId: null,
  dueDate: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-03-17T00:00:00Z'),
  updatedAt: new Date('2026-03-17T00:00:00Z'),
  deletedAt: null,
  deletedBy: null,
};

describe('TasksService', () => {
  let service: TasksService;
  let mockDb: ReturnType<typeof createMockDb>;
  let eventEmitterMock: { emit: ReturnType<typeof vi.fn> };
  let workflowEngineMock: {
    transition: ReturnType<typeof vi.fn>;
    getAvailableTransitions: ReturnType<typeof vi.fn>;
  };
  let workflowRegistryMock: {
    getBySlug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = createMockDb();
    eventEmitterMock = { emit: vi.fn() };
    workflowEngineMock = {
      transition: vi.fn().mockResolvedValue({
        historyId: 'h-1',
        fromState: 'open',
        toState: 'in_progress',
        transitionId: 'trans-1',
        recordedAt: '2026-03-17T00:00:00Z',
      }),
      getAvailableTransitions: vi.fn().mockReturnValue([
        {
          transitionId: 'trans-1',
          transitionName: 'Start',
          toState: 'in_progress',
          toStateLabel: 'In Progress',
          toStateColor: '#3B82F6',
          requiredPermissions: [],
        },
      ]),
    };
    workflowRegistryMock = {
      getBySlug: vi.fn().mockReturnValue({
        id: 'def-1',
        slug: 'task-status',
        initialState: 'open',
      }),
    };

    service = new TasksService(
      { db: mockDb } as any,
      eventEmitterMock as any,
      workflowEngineMock as any,
      workflowRegistryMock as any,
    );
  });

  describe('findOneOrFail', () => {
    it('should return task when found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([mockTask]);

      const result = await service.findOneOrFail('task-1');

      expect(result.id).toBe('task-1');
      expect(result.title).toBe('Test Task');
      expect(result.status).toBe('open');
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findOneOrFail('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create task with initial state from workflow', async () => {
      mockDb._chain.returning.mockResolvedValueOnce([mockTask]);

      const result = await service.create({ title: 'Test Task' }, 'user-1');

      expect(result.title).toBe('Test Task');
      expect(result.status).toBe('open');
      expect(mockDb.insert).toHaveBeenCalled();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'tasks.TaskCreated',
        expect.objectContaining({
          entityType: 'tasks',
          entityId: 'task-1',
          actorId: 'user-1',
        }),
      );
    });

    it('should use default initial state when workflow not found', async () => {
      workflowRegistryMock.getBySlug.mockReturnValue(undefined);
      mockDb._chain.returning.mockResolvedValueOnce([mockTask]);

      const result = await service.create({ title: 'Test Task' }, 'user-1');

      expect(result.status).toBe('open');
    });
  });

  describe('update', () => {
    it('should update task fields (not status)', async () => {
      const updatedTask = { ...mockTask, title: 'Updated Title' };
      mockDb._chain.limit.mockResolvedValueOnce([mockTask]); // findOneOrFail
      mockDb._chain.returning.mockResolvedValueOnce([updatedTask]);

      const result = await service.update('task-1', { title: 'Updated Title' }, 'user-1');

      expect(result.title).toBe('Updated Title');
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'tasks.TaskUpdated',
        expect.objectContaining({
          payload: { changes: ['title'] },
        }),
      );
    });

    it('should return existing task when no changes provided', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([mockTask]); // findOneOrFail
      mockDb._chain.limit.mockResolvedValueOnce([mockTask]); // second findOneOrFail for no-op

      const result = await service.update('task-1', {}, 'user-1');

      expect(result.id).toBe('task-1');
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should soft delete and emit event', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([mockTask]); // findOneOrFail

      await service.softDelete('task-1', 'user-1');

      expect(mockDb.update).toHaveBeenCalled();
      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'tasks.TaskDeleted',
        expect.objectContaining({
          entityType: 'tasks',
          entityId: 'task-1',
          payload: { title: 'Test Task' },
        }),
      );
    });

    it('should throw NotFoundException for nonexistent task', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('transitionStatus', () => {
    it('should validate via workflow engine, then update status', async () => {
      const transitioned = { ...mockTask, status: 'in_progress' };
      mockDb._chain.limit.mockResolvedValueOnce([mockTask]); // findOneOrFail
      mockDb._chain.returning.mockResolvedValueOnce([transitioned]);

      const result = await service.transitionStatus('task-1', 'in_progress', 'user-1');

      expect(workflowEngineMock.transition).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowSlug: 'task-status',
          entityType: 'task',
          entityId: 'task-1',
          fromState: 'open',
          toState: 'in_progress',
          actorId: 'user-1',
        }),
      );
      expect(result.status).toBe('in_progress');
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return available transitions for current state', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([mockTask]); // findOneOrFail

      const result = await service.getAvailableTransitions('task-1');

      expect(workflowEngineMock.getAvailableTransitions).toHaveBeenCalledWith('task-status', 'open');
      expect(result).toHaveLength(1);
      expect(result[0].transitionName).toBe('Start');
    });
  });

  describe('list', () => {
    it('should return paginated results', async () => {
      // Mock count query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 1 }]),
        }),
      });

      // Mock data query
      const dataChain = createMockChain();
      dataChain.offset.mockResolvedValue([mockTask]);
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue(dataChain),
      });

      const result = await service.list({ page: 1, limit: 25 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });
});
