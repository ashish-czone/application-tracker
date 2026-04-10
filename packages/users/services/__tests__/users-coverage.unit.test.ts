import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { USERS_USER_DELETED } from '../../events/types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: any, data: any) => data),
}));

// --- Mock helpers ---

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    transaction: vi.fn(),
    _chain: mockChain,
  };
}

function createMockAuthService() {
  return {
    createPasswordCredential: vi.fn().mockResolvedValue(undefined),
    changePasswordDirect: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockRbacService() {
  return {
    findRoleById: vi.fn().mockResolvedValue(null),
    assignRoleToUser: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockEventEmitter() {
  return {
    emit: vi.fn(),
  };
}

function createMockAppLogger() {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx) } as any;
}

function createService() {
  const mockDb = createMockDb();
  const authService = createMockAuthService();
  const rbacService = createMockRbacService();
  const eventEmitter = createMockEventEmitter();
  const appLogger = createMockAppLogger();

  const service = new UsersService(
    authService as any,
    rbacService as any,
    { db: mockDb } as any,
    eventEmitter as any,
    appLogger,
  );

  return { service, mockDb, authService, rbacService, eventEmitter };
}

// --- Fixtures ---

const now = new Date('2026-01-15T10:00:00.000Z');

function makeUserRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'user-1',
    email: 'alice@example.com',
    phone: '+15551234567',
    firstName: 'Alice',
    lastName: 'Smith',
    userType: 'admin',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

// --- Tests ---

describe('UsersService – additional coverage', () => {
  let service: UsersService;
  let mockDb: ReturnType<typeof createMockDb>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ service, mockDb, eventEmitter } = createService());
  });

  // ──────────────────────────────────────────────────────────
  // softDelete() – deeper coverage
  // ──────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should set deletedAt to a Date close to now', async () => {
      const existing = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      const beforeCall = new Date();
      await service.softDelete('user-1', 'actor-1');
      const afterCall = new Date();

      const setCall = mockDb._chain.set.mock.calls[0][0];
      expect(setCall.deletedAt).toBeInstanceOf(Date);
      expect(setCall.deletedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(setCall.deletedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should set deletedBy to the actorId', async () => {
      const existing = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.softDelete('user-1', 'actor-42');

      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ deletedBy: 'actor-42' }),
      );
    });

    it('should call update on the database', async () => {
      const existing = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.softDelete('user-1', 'actor-1');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should emit event with before snapshot', async () => {
      const existing = makeUserRow({
        email: 'bob@example.com',
        firstName: 'Bob',
        lastName: 'Jones',
        phone: '+15559999999',
        userType: 'recruiter',
      });
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.softDelete('user-1', 'actor-1');

      const emitCall = eventEmitter.emit.mock.calls[0];
      expect(emitCall[0]).toBe(USERS_USER_DELETED);
      expect(emitCall[1].payload.before).toEqual({
        email: 'bob@example.com',
        phone: '+15559999999',
        firstName: 'Bob',
        lastName: 'Jones',
        userType: 'recruiter',
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent', 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw with correct message when user not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent', 'actor-1'))
        .rejects.toThrow('User not found');
    });

    it('should emit event with correct entityId and actorId', async () => {
      const existing = makeUserRow({ id: 'user-99' });
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.softDelete('user-99', 'actor-5');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_DELETED,
        expect.objectContaining({
          entityType: 'users',
          entityId: 'user-99',
          actorId: 'actor-5',
        }),
      );
    });

    it('should include email, firstName, and lastName in event payload', async () => {
      const existing = makeUserRow({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.softDelete('user-1', 'actor-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_DELETED,
        expect.objectContaining({
          payload: expect.objectContaining({
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
          }),
        }),
      );
    });
  });
});
