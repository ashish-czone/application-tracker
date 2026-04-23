import { describe, it, expect, beforeEach, vi } from 'vitest';
import { USERS_USER_DEACTIVATED, type UserDeactivatedEvent } from '@packages/users';
import { TasksUserLifecycleListener } from '../tasks-user-lifecycle.listener';

function createMockDb() {
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
  return {
    update: vi.fn().mockReturnValue(updateChain),
    _update: updateChain,
  };
}

function createLogger() {
  return {
    forContext: vi.fn().mockReturnValue({
      log: vi.fn(),
      error: vi.fn(),
    }),
  } as any;
}

function makeEvent(userId: string): UserDeactivatedEvent {
  return {
    eventName: USERS_USER_DEACTIVATED,
    entityType: 'users',
    entityId: userId,
    actorId: 'admin-1',
    correlationId: 'corr-1',
    occurredAt: new Date(),
    payload: { before: { id: userId, email: 'x@example.com' } },
  };
}

describe('TasksUserLifecycleListener', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let listener: TasksUserLifecycleListener;

  beforeEach(() => {
    mockDb = createMockDb();
    listener = new TasksUserLifecycleListener({ db: mockDb } as any, createLogger());
  });

  it('issues an UPDATE against tasks setting assigneeId to null', async () => {
    mockDb._update.returning.mockResolvedValueOnce([{ id: 'task-1' }, { id: 'task-2' }]);
    await listener.onUserDeactivated(makeEvent('user-123'));

    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb._update.set).toHaveBeenCalledWith({ assigneeId: null });
  });

  it('is a no-op (no error) when the deactivated user owns no open tasks', async () => {
    mockDb._update.returning.mockResolvedValueOnce([]);
    await expect(listener.onUserDeactivated(makeEvent('user-nobody'))).resolves.toBeUndefined();
  });

  it('swallows DB errors so handler failure never rolls back deactivation', async () => {
    mockDb._update.returning.mockRejectedValueOnce(new Error('boom'));
    await expect(listener.onUserDeactivated(makeEvent('user-1'))).resolves.toBeUndefined();
  });
});
