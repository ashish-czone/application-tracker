import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ComplianceTasksService } from '../compliance-tasks.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockInsertReturning(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockUpdateReturning(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockSelectChain(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockResolvedValue(rows);
  chain.limit = vi.fn().mockImplementation((n: number) => {
    if (n === 1) return Promise.resolve(rows);
    return chain;
  });
  // `.where()` must both keep the chain alive (for orderBy/limit/offset) and be
  // awaitable on its own (for queries that stop after the filter). Mimic
  // Drizzle's thenable query builder by attaching .then to the returned chain.
  chain.where = vi.fn().mockReturnValue({
    ...chain,
    then: (resolve: (value: unknown) => unknown) => resolve(rows),
  } as AnyChain);
  return chain;
}

function mockDelete() {
  const chain: AnyChain = {} as AnyChain;
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

function taskRowFixture(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'task-1',
    title: 'GST Return',
    description: null,
    status: 'pending',
    priority: 'medium',
    assigneeId: null,
    assigneeTeamId: 'org-1',
    dueDate: '2026-05-20',
    completedAt: null,
    kind: 'compliance',
    externalKey: 'r1:c1:2026-04-01',
    createdBy: 'system',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

function extRowFixture(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    taskId: 'task-1',
    ruleId: 'r1',
    clientId: 'c1',
    lawId: 'l1',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
    ...overrides,
  };
}

describe('ComplianceTasksService', () => {
  let db: { db: Record<string, ReturnType<typeof vi.fn>> };
  let events: { emitDynamic: ReturnType<typeof vi.fn> };
  let service: ComplianceTasksService;

  beforeEach(() => {
    db = {
      db: {
        transaction: vi.fn(),
        select: vi.fn(),
        delete: vi.fn(),
      },
    };
    events = { emitDynamic: vi.fn() };
    service = new ComplianceTasksService(db as never, events as never);
  });

  describe('create', () => {
    const input = {
      title: 'GST Return',
      dueDate: '2026-05-20',
      ruleId: 'r1',
      clientId: 'c1',
      lawId: 'l1',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
    };

    it('inserts tasks + compliance_tasks in one transaction and returns the joined row', async () => {
      const taskRow = taskRowFixture();
      const extRow = extRowFixture();
      const tasksInsert = mockInsertReturning([taskRow]);
      const extInsert = mockInsertReturning([extRow]);
      const tx = {
        insert: vi.fn().mockReturnValueOnce(tasksInsert).mockReturnValueOnce(extInsert),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      const result = await service.create(input, 'system');

      expect(db.db.transaction).toHaveBeenCalledTimes(1);
      expect(tx.insert).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('task-1');
      expect(result.clientId).toBe('c1');
      expect(result.periodStart).toBe('2026-04-01');
      expect(result.externalKey).toBe('r1:c1:2026-04-01');
    });

    it('sets kind=compliance and builds externalKey on the tasks row', async () => {
      const tasksInsert = mockInsertReturning([taskRowFixture()]);
      const extInsert = mockInsertReturning([extRowFixture()]);
      const tx = {
        insert: vi.fn().mockReturnValueOnce(tasksInsert).mockReturnValueOnce(extInsert),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.create(input, 'user-42');

      const tasksValues = (tx.insert.mock.results[0].value as AnyChain).values.mock
        .calls[0][0] as Record<string, unknown>;
      expect(tasksValues.kind).toBe('compliance');
      expect(tasksValues.externalKey).toBe('r1:c1:2026-04-01');
      expect(tasksValues.createdBy).toBe('user-42');
      expect(tasksValues.priority).toBe('medium');
      expect(tasksValues).not.toHaveProperty('relatedEntityId');
    });

    it('propagates priority and assignee overrides into the tasks insert', async () => {
      const tasksInsert = mockInsertReturning([taskRowFixture()]);
      const extInsert = mockInsertReturning([extRowFixture()]);
      const tx = {
        insert: vi.fn().mockReturnValueOnce(tasksInsert).mockReturnValueOnce(extInsert),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.create(
        { ...input, priority: 'high', assigneeId: 'u1', description: 'note' },
        'user-42',
      );

      const tasksValues = (tx.insert.mock.results[0].value as AnyChain).values.mock
        .calls[0][0] as Record<string, unknown>;
      expect(tasksValues.priority).toBe('high');
      expect(tasksValues.assigneeId).toBe('u1');
      expect(tasksValues.description).toBe('note');
    });

    it('writes (ruleId, clientId, lawId, period*) into the extension insert', async () => {
      const tasksInsert = mockInsertReturning([taskRowFixture()]);
      const extInsert = mockInsertReturning([extRowFixture()]);
      const tx = {
        insert: vi.fn().mockReturnValueOnce(tasksInsert).mockReturnValueOnce(extInsert),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.create(input, 'system');

      const extValues = (tx.insert.mock.results[1].value as AnyChain).values.mock
        .calls[0][0] as Record<string, unknown>;
      expect(extValues).toMatchObject({
        taskId: 'task-1',
        ruleId: 'r1',
        clientId: 'c1',
        lawId: 'l1',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
      });
      expect(extValues).not.toHaveProperty('externalKey');
    });

    it('emits tasks.Created and compliance.ComplianceTaskGenerated after the tx commits', async () => {
      const tasksInsert = mockInsertReturning([taskRowFixture()]);
      const extInsert = mockInsertReturning([extRowFixture()]);
      const tx = {
        insert: vi.fn().mockReturnValueOnce(tasksInsert).mockReturnValueOnce(extInsert),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.create(input, 'user-42');

      expect(events.emitDynamic).toHaveBeenCalledTimes(2);
      expect(events.emitDynamic).toHaveBeenNthCalledWith(
        1,
        'tasks.Created',
        expect.objectContaining({ entityType: 'tasks', entityId: 'task-1', actorId: 'user-42' }),
      );
      expect(events.emitDynamic).toHaveBeenNthCalledWith(
        2,
        'compliance.ComplianceTaskGenerated',
        expect.objectContaining({
          entityType: 'compliance_rule',
          entityId: 'r1',
          actorId: 'user-42',
          payload: expect.objectContaining({
            ruleId: 'r1',
            clientId: 'c1',
            lawId: 'l1',
            taskId: 'task-1',
            externalKey: 'r1:c1:2026-04-01',
            periodStart: '2026-04-01',
            periodEnd: '2026-04-30',
            dueDate: '2026-05-20',
          }),
        }),
      );
    });

    it('sets actorId to null on the compliance event when actor is "system"', async () => {
      const tasksInsert = mockInsertReturning([taskRowFixture()]);
      const extInsert = mockInsertReturning([extRowFixture()]);
      const tx = {
        insert: vi.fn().mockReturnValueOnce(tasksInsert).mockReturnValueOnce(extInsert),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.create(input, 'system');

      expect(events.emitDynamic).toHaveBeenNthCalledWith(
        2,
        'compliance.ComplianceTaskGenerated',
        expect.objectContaining({ actorId: null }),
      );
    });
  });

  describe('findByExternalKey', () => {
    it('returns the task id when the key exists', async () => {
      db.db.select.mockReturnValue(mockSelectChain([{ taskId: 'task-1' }]));
      const result = await service.findByExternalKey('r1:c1:2026-04-01');
      expect(result).toEqual({ taskId: 'task-1' });
    });

    it('returns null when no row matches', async () => {
      db.db.select.mockReturnValue(mockSelectChain([]));
      const result = await service.findByExternalKey('r1:c1:2099-01-01');
      expect(result).toBeNull();
    });
  });

  describe('findByRuleClientPeriod', () => {
    it('returns the task id for a matching tuple', async () => {
      db.db.select.mockReturnValue(mockSelectChain([{ taskId: 'task-1' }]));
      const result = await service.findByRuleClientPeriod('r1', 'c1', '2026-04-01');
      expect(result).toEqual({ taskId: 'task-1' });
    });

    it('returns null when no row matches', async () => {
      db.db.select.mockReturnValue(mockSelectChain([]));
      const result = await service.findByRuleClientPeriod('rX', 'cX', '2099-01-01');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when no task matches', async () => {
      db.db.select.mockReturnValue(mockSelectChain([]));
      await expect(service.update('missing', { title: 'x' }, 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('skips the update query when no fields are provided but still emits no event', async () => {
      const existingTask = taskRowFixture();
      const existingExt = extRowFixture();
      db.db.select.mockReturnValue(mockSelectChain([{ task: existingTask, ext: existingExt }]));
      const tx = {
        update: vi.fn(),
      };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      const result = await service.update('task-1', {}, 'user-1');

      expect(tx.update).not.toHaveBeenCalled();
      expect(result.id).toBe('task-1');
      expect(events.emitDynamic).toHaveBeenCalledWith(
        'tasks.Updated',
        expect.objectContaining({ entityType: 'tasks', entityId: 'task-1' }),
      );
    });

    it('applies provided fields via tx.update and emits tasks.Updated with before/after', async () => {
      const existingTask = taskRowFixture({ title: 'old' });
      const existingExt = extRowFixture();
      const updatedTask = taskRowFixture({ title: 'new' });
      db.db.select.mockReturnValue(mockSelectChain([{ task: existingTask, ext: existingExt }]));
      const updateChain = mockUpdateReturning([updatedTask]);
      const tx = { update: vi.fn().mockReturnValue(updateChain) };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      const result = await service.update('task-1', { title: 'new' }, 'user-1');

      expect(tx.update).toHaveBeenCalledTimes(1);
      expect(updateChain.set).toHaveBeenCalledWith({ title: 'new' });
      expect(result.title).toBe('new');
      expect(events.emitDynamic).toHaveBeenCalledWith(
        'tasks.Updated',
        expect.objectContaining({
          entityType: 'tasks',
          entityId: 'task-1',
          actorId: 'user-1',
          payload: expect.objectContaining({
            before: existingTask,
            after: updatedTask,
          }),
        }),
      );
    });

    it('stamps completedAt=now when transitioning status to "completed"', async () => {
      const existingTask = taskRowFixture({ status: 'pending', completedAt: null });
      const existingExt = extRowFixture();
      const updatedTask = taskRowFixture({ status: 'completed', completedAt: new Date() });
      db.db.select.mockReturnValue(mockSelectChain([{ task: existingTask, ext: existingExt }]));
      const updateChain = mockUpdateReturning([updatedTask]);
      const tx = { update: vi.fn().mockReturnValue(updateChain) };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.update('task-1', { status: 'completed' }, 'user-1');

      const setArg = updateChain.set.mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.status).toBe('completed');
      expect(setArg.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when reopening from completed back to pending', async () => {
      const existingTask = taskRowFixture({ status: 'completed', completedAt: new Date() });
      const existingExt = extRowFixture();
      const updatedTask = taskRowFixture({ status: 'pending', completedAt: null });
      db.db.select.mockReturnValue(mockSelectChain([{ task: existingTask, ext: existingExt }]));
      const updateChain = mockUpdateReturning([updatedTask]);
      const tx = { update: vi.fn().mockReturnValue(updateChain) };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.update('task-1', { status: 'pending' }, 'user-1');

      const setArg = updateChain.set.mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.status).toBe('pending');
      expect(setArg.completedAt).toBeNull();
    });

    it('does not touch completedAt when the patch has no status', async () => {
      const existingTask = taskRowFixture({ status: 'in_progress', completedAt: null });
      const existingExt = extRowFixture();
      const updatedTask = taskRowFixture({ status: 'in_progress', title: 'new' });
      db.db.select.mockReturnValue(mockSelectChain([{ task: existingTask, ext: existingExt }]));
      const updateChain = mockUpdateReturning([updatedTask]);
      const tx = { update: vi.fn().mockReturnValue(updateChain) };
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.update('task-1', { title: 'new' }, 'user-1');

      const setArg = updateChain.set.mock.calls[0][0] as Record<string, unknown>;
      expect(setArg).not.toHaveProperty('completedAt');
      expect(setArg.title).toBe('new');
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when no task matches', async () => {
      db.db.select.mockReturnValue(mockSelectChain([]));
      await expect(service.delete('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('hard-deletes the tasks row and emits tasks.Deleted', async () => {
      const existingTask = taskRowFixture();
      const existingExt = extRowFixture();
      db.db.select.mockReturnValue(mockSelectChain([{ task: existingTask, ext: existingExt }]));
      db.db.delete.mockReturnValue(mockDelete());

      await service.delete('task-1', 'user-1');

      expect(db.db.delete).toHaveBeenCalledTimes(1);
      expect(events.emitDynamic).toHaveBeenCalledWith(
        'tasks.Deleted',
        expect.objectContaining({
          entityType: 'tasks',
          entityId: 'task-1',
          actorId: 'user-1',
          payload: expect.objectContaining({ before: existingTask }),
        }),
      );
    });
  });

  describe('list', () => {
    it('returns joined rows and a total count', async () => {
      const taskRow = taskRowFixture();
      const extRow = extRowFixture();
      const firstCall = mockSelectChain([{ task: taskRow, ext: extRow }]);
      const secondCall = mockSelectChain([{ id: 'task-1' }]);
      db.db.select.mockReturnValueOnce(firstCall).mockReturnValueOnce(secondCall);

      const result = await service.list({ clientId: 'c1', limit: 50 });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe('task-1');
      expect(result.total).toBe(1);
    });
  });
});
