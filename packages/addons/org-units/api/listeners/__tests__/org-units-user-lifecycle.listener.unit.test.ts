import { describe, it, expect, beforeEach, vi } from 'vitest';
import { USERS_USER_DEACTIVATED, type UserDeactivatedEvent } from '@packages/users';
import { OrgUnitsUserLifecycleListener } from '../org-units-user-lifecycle.listener';

function createMockDb() {
  const deleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };
  return {
    delete: vi.fn().mockReturnValue(deleteChain),
    _delete: deleteChain,
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

describe('OrgUnitsUserLifecycleListener', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let listener: OrgUnitsUserLifecycleListener;

  beforeEach(() => {
    mockDb = createMockDb();
    listener = new OrgUnitsUserLifecycleListener({ db: mockDb } as any, createLogger());
  });

  it('issues a DELETE against org_unit_members for the deactivated user', async () => {
    await listener.onUserDeactivated(makeEvent('user-123'));
    expect(mockDb.delete).toHaveBeenCalledTimes(1);
    expect(mockDb._delete.where).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — re-running just deletes zero rows with no error', async () => {
    mockDb._delete.where.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    await listener.onUserDeactivated(makeEvent('user-123'));
    await expect(listener.onUserDeactivated(makeEvent('user-123'))).resolves.toBeUndefined();
  });

  it('swallows DB errors so handler failure never rolls back deactivation', async () => {
    mockDb._delete.where.mockRejectedValueOnce(new Error('boom'));
    await expect(listener.onUserDeactivated(makeEvent('user-1'))).resolves.toBeUndefined();
  });
});
