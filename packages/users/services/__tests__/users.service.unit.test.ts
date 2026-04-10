import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users.service';
import {
  USERS_USER_CREATED,
  USERS_USER_UPDATED,
  USERS_USER_DELETED,
} from '../../events/types';

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

describe('UsersService', () => {
  let service: UsersService;
  let mockDb: ReturnType<typeof createMockDb>;
  let authService: ReturnType<typeof createMockAuthService>;
  let rbacService: ReturnType<typeof createMockRbacService>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    ({ service, mockDb, authService, rbacService, eventEmitter } = createService());
  });

  // ──────────────────────────────────────────────────────────
  // list()
  // ──────────────────────────────────────────────────────────

  describe('list', () => {
    it('should return paginated results with correct meta', async () => {
      const row = makeUserRow();
      // Count query resolves via where, data query continues chaining
      let whereCallCount = 0;
      mockDb._chain.where.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 1) return Promise.resolve([{ total: 1 }]);
        if (whereCallCount === 3) return Promise.resolve([]);  // roles batch-load
        return mockDb._chain; // data query — continue chaining
      });
      mockDb._chain.offset.mockResolvedValueOnce([row]);

      const result = await service.list({ page: 1, limit: 10 });

      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe('alice@example.com');
    });

    it('should calculate offset correctly for page > 1', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 30 }]);
      mockDb._chain.offset.mockResolvedValueOnce([]);

      await service.list({ page: 3, limit: 10 });

      // offset should be called with (3-1)*10 = 20
      expect(mockDb._chain.offset).toHaveBeenCalledWith(20);
    });

    it('should default to page 1 and limit 25 when not specified', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 0 }]);
      mockDb._chain.offset.mockResolvedValueOnce([]);

      const result = await service.list({});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
      expect(mockDb._chain.offset).toHaveBeenCalledWith(0);
    });

    it('should return empty data array when no users found', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 0 }]);
      mockDb._chain.offset.mockResolvedValueOnce([]);

      const result = await service.list({});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should calculate totalPages correctly (ceiling division)', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 11 }]);
      mockDb._chain.offset.mockResolvedValueOnce([]);

      const result = await service.list({ limit: 5 });

      expect(result.meta.totalPages).toBe(3); // ceil(11/5)
    });

    it('should batch-load roles for returned users', async () => {
      const row1 = makeUserRow({ id: 'user-1' });
      const row2 = makeUserRow({ id: 'user-2', email: 'bob@example.com' });
      let whereCallCount = 0;
      mockDb._chain.where.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 1) return Promise.resolve([{ total: 2 }]);
        if (whereCallCount === 3) {
          // Roles batch-load returns roles for user-1 only
          return Promise.resolve([
            { userId: 'user-1', roleId: 'role-1', roleName: 'Admin' },
          ]);
        }
        return mockDb._chain;
      });
      mockDb._chain.offset.mockResolvedValueOnce([row1, row2]);

      const result = await service.list({});

      expect(result.data[0].roles).toEqual([{ id: 'role-1', name: 'Admin' }]);
      expect(result.data[1].roles).toEqual([]);
    });

    it('should skip role batch-load when no users on page', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 0 }]);
      mockDb._chain.offset.mockResolvedValueOnce([]);

      await service.list({});

      // innerJoin should not have been called for role loading
      // The select count is 2 calls total (count + data), no 3rd call
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple roles per user in batch-load', async () => {
      const row = makeUserRow({ id: 'user-1' });
      let whereCallCount = 0;
      mockDb._chain.where.mockImplementation(() => {
        whereCallCount++;
        if (whereCallCount === 1) return Promise.resolve([{ total: 1 }]);
        if (whereCallCount === 3) {
          return Promise.resolve([
            { userId: 'user-1', roleId: 'role-1', roleName: 'Admin' },
            { userId: 'user-1', roleId: 'role-2', roleName: 'Manager' },
          ]);
        }
        return mockDb._chain;
      });
      mockDb._chain.offset.mockResolvedValueOnce([row]);

      const result = await service.list({});

      expect(result.data[0].roles).toHaveLength(2);
      expect(result.data[0].roles[0]).toEqual({ id: 'role-1', name: 'Admin' });
      expect(result.data[0].roles[1]).toEqual({ id: 'role-2', name: 'Manager' });
    });
  });

  // ──────────────────────────────────────────────────────────
  // findOneOrFail()
  // ──────────────────────────────────────────────────────────

  describe('findOneOrFail', () => {
    it('should return user when found', async () => {
      const row = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([row]);

      const result = await service.findOneOrFail('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('alice@example.com');
      expect(result.firstName).toBe('Alice');
      expect(result.lastName).toBe('Smith');
      expect(result.roles).toEqual([]);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findOneOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findOneOrFail('nonexistent'))
        .rejects.toThrow('User not found');
    });
  });

  // ──────────────────────────────────────────────────────────
  // create()
  // ──────────────────────────────────────────────────────────

  describe('create', () => {
    const createInput = {
      email: 'bob@example.com',
      phone: '+15559876543',
      firstName: 'Bob',
      lastName: 'Jones',
      password: 'secureP@ss123',
      userType: 'admin',
      roleIds: ['role-1'],
    };

    it('should create user when email is unique', async () => {
      rbacService.findRoleById.mockResolvedValueOnce({ id: 'role-1', name: 'Admin', userType: 'admin' });
      // Email uniqueness check returns empty
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const newUser = makeUserRow({
        id: 'user-new',
        email: 'bob@example.com',
        phone: '+15559876543',
        firstName: 'Bob',
        lastName: 'Jones',
      });

      // Transaction mock: simulate tx behavior
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const txChain = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([newUser]),
            }),
          }),
        };
        return fn(txChain);
      });

      const result = await service.create(createInput, 'actor-1');

      expect(result.email).toBe('bob@example.com');
      expect(result.firstName).toBe('Bob');
    });

    it('should throw ConflictException when email already exists', async () => {
      rbacService.findRoleById.mockResolvedValueOnce({ id: 'role-1', name: 'Admin', userType: 'admin' });
      // Email uniqueness check returns existing user
      mockDb._chain.limit.mockResolvedValueOnce([{ id: 'existing-user' }]);

      await expect(service.create(createInput, 'actor-1'))
        .rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException with correct message for duplicate email', async () => {
      rbacService.findRoleById.mockResolvedValueOnce({ id: 'role-1', name: 'Admin', userType: 'admin' });
      mockDb._chain.limit.mockResolvedValueOnce([{ id: 'existing-user' }]);

      await expect(service.create(createInput, 'actor-1'))
        .rejects.toThrow('Email already in use');
    });

    it('should lowercase email before storage', async () => {
      rbacService.findRoleById.mockResolvedValueOnce({ id: 'role-1', name: 'Admin', userType: 'admin' });
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const newUser = makeUserRow({ id: 'user-new', email: 'bob@example.com' });
      let capturedValues: any;
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const txChain = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockImplementation((vals: any) => {
              capturedValues = vals;
              return { returning: vi.fn().mockResolvedValue([newUser]) };
            }),
          }),
        };
        return fn(txChain);
      });

      await service.create(
        { ...createInput, email: 'BOB@EXAMPLE.COM' },
        'actor-1',
      );

      expect(capturedValues.email).toBe('bob@example.com');
    });

    it('should create password credential via auth service', async () => {
      rbacService.findRoleById.mockResolvedValueOnce({ id: 'role-1', name: 'Admin', userType: 'admin' });
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const newUser = makeUserRow({ id: 'user-new', email: 'bob@example.com' });
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const txChain = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([newUser]),
            }),
          }),
        };
        return fn(txChain);
      });

      await service.create(createInput, 'actor-1');

      expect(authService.createPasswordCredential).toHaveBeenCalledWith(
        'user-new',
        'bob@example.com',
        'secureP@ss123',
        expect.anything(), // tx
      );
    });

    it('should assign roles after user creation', async () => {
      rbacService.findRoleById.mockResolvedValueOnce({ id: 'role-1', name: 'Admin', userType: 'admin' });
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const newUser = makeUserRow({ id: 'user-new' });
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const txChain = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([newUser]),
            }),
          }),
        };
        return fn(txChain);
      });

      await service.create(createInput, 'actor-1');

      expect(rbacService.assignRoleToUser).toHaveBeenCalledWith('user-new', 'role-1');
    });

    it('should emit USERS_USER_CREATED event', async () => {
      rbacService.findRoleById.mockResolvedValueOnce({ id: 'role-1', name: 'Admin', userType: 'admin' });
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const newUser = makeUserRow({ id: 'user-new', email: 'bob@example.com', firstName: 'Bob', lastName: 'Jones' });
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const txChain = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([newUser]),
            }),
          }),
        };
        return fn(txChain);
      });

      await service.create(createInput, 'actor-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_CREATED,
        expect.objectContaining({
          entityType: 'users',
          entityId: 'user-new',
          actorId: 'actor-1',
          payload: expect.objectContaining({
            email: 'bob@example.com',
            firstName: 'Bob',
            lastName: 'Jones',
            userType: 'admin',
            after: expect.objectContaining({
              email: 'bob@example.com',
              firstName: 'Bob',
              lastName: 'Jones',
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException when role does not exist', async () => {
      rbacService.findRoleById.mockResolvedValueOnce(null);

      await expect(service.create(createInput, 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when role userType does not match', async () => {
      rbacService.findRoleById.mockResolvedValueOnce({ id: 'role-1', name: 'Client Role', userType: 'client' });

      await expect(service.create({ ...createInput, userType: 'admin' }, 'actor-1'))
        .rejects.toThrow(ConflictException);
    });
  });

  // ──────────────────────────────────────────────────────────
  // update()
  // ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return the user', async () => {
      const existing = makeUserRow();
      // findOneOrFail lookup
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      const updated = makeUserRow({ firstName: 'Alicia', updatedAt: new Date() });
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      const result = await service.update('user-1', { firstName: 'Alicia' }, 'actor-1');

      expect(result.firstName).toBe('Alicia');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return existing user when no fields changed (empty update)', async () => {
      const existing = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      const result = await service.update('user-1', {}, 'actor-1');

      // findOneOrFail adds roles: [] to the returned UserWithType
      expect(result).toEqual({ ...existing, roles: [] });
      // Should NOT call update on DB
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should check email uniqueness when email is being changed', async () => {
      const existing = makeUserRow({ email: 'alice@example.com' });
      mockDb._chain.limit
        .mockResolvedValueOnce([existing])  // findOneOrFail
        .mockResolvedValueOnce([{ id: 'other-user' }]);  // email uniqueness check

      await expect(
        service.update('user-1', { email: 'taken@example.com' }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should skip email uniqueness check when email is unchanged', async () => {
      const existing = makeUserRow({ email: 'alice@example.com' });
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      const updated = makeUserRow({ email: 'alice@example.com', firstName: 'Updated' });
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      // Updating email to same value (case-insensitive match)
      await service.update('user-1', { email: 'alice@example.com', firstName: 'Updated' }, 'actor-1');

      // Only 1 select call (findOneOrFail) — no second uniqueness check
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });

    it('should emit USERS_USER_UPDATED event with changes and snapshots', async () => {
      const existing = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      const updated = makeUserRow({ firstName: 'Alicia' });
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      await service.update('user-1', { firstName: 'Alicia' }, 'actor-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_UPDATED,
        expect.objectContaining({
          entityType: 'users',
          entityId: 'user-1',
          actorId: 'actor-1',
          payload: expect.objectContaining({
            changes: ['firstName'],
            before: expect.objectContaining({
              email: 'alice@example.com',
              firstName: 'Alice',
            }),
            after: expect.objectContaining({
              firstName: 'Alicia',
            }),
          }),
        }),
      );
    });

    it('should not emit event when nothing changed', async () => {
      const existing = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.update('user-1', {}, 'actor-1');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.update('nonexistent', { firstName: 'X' }, 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should lowercase email on update', async () => {
      const existing = makeUserRow({ email: 'alice@example.com' });
      mockDb._chain.limit
        .mockResolvedValueOnce([existing])  // findOneOrFail
        .mockResolvedValueOnce([]);  // email uniqueness (no conflict)

      const updated = makeUserRow({ email: 'newemail@example.com' });
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      await service.update('user-1', { email: 'NEWEMAIL@EXAMPLE.COM' }, 'actor-1');

      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'newemail@example.com' }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // softDelete()
  // ──────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('should mark user as deleted', async () => {
      const existing = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.softDelete('user-1', 'actor-1');

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb._chain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: 'actor-1',
        }),
      );
    });

    it('should emit USERS_USER_DELETED event', async () => {
      const existing = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.softDelete('user-1', 'actor-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_DELETED,
        expect.objectContaining({
          entityType: 'users',
          entityId: 'user-1',
          actorId: 'actor-1',
          payload: expect.objectContaining({
            email: 'alice@example.com',
            firstName: 'Alice',
            lastName: 'Smith',
            before: expect.objectContaining({
              email: 'alice@example.com',
              firstName: 'Alice',
              lastName: 'Smith',
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent', 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────
  // resetPassword()
  // ──────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should delegate to auth service changePasswordDirect', async () => {
      const existing = makeUserRow();
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      await service.resetPassword('user-1', 'newP@ssword456');

      expect(authService.changePasswordDirect).toHaveBeenCalledWith('user-1', 'newP@ssword456');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.resetPassword('nonexistent', 'newP@ssword456'))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────
  // restore()
  // ──────────────────────────────────────────────────────────

  describe('restore', () => {
    it('should restore a deleted user', async () => {
      const deletedRow = makeUserRow({ deletedAt: new Date('2026-01-10T00:00:00Z') });
      mockDb._chain.limit.mockResolvedValueOnce([deletedRow]);

      const restoredRow = makeUserRow({ deletedAt: null });
      mockDb._chain.returning.mockResolvedValueOnce([restoredRow]);

      const result = await service.restore('user-1');

      expect(result.deletedAt).toBeNull();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb._chain.set).toHaveBeenCalledWith({ deletedAt: null, deletedBy: null });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.restore('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with correct message', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.restore('nonexistent'))
        .rejects.toThrow('User not found');
    });

    it('should throw ConflictException when user is not deleted', async () => {
      const activeRow = makeUserRow({ deletedAt: null });
      mockDb._chain.limit.mockResolvedValueOnce([activeRow]);

      await expect(service.restore('user-1'))
        .rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException with correct message when not deleted', async () => {
      const activeRow = makeUserRow({ deletedAt: null });
      mockDb._chain.limit.mockResolvedValueOnce([activeRow]);

      await expect(service.restore('user-1'))
        .rejects.toThrow('User is not deleted');
    });
  });

  // ──────────────────────────────────────────────────────────
  // getEmail()
  // ──────────────────────────────────────────────────────────

  describe('getEmail', () => {
    it('should return email when user exists', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ email: 'alice@example.com' }]);

      const result = await service.getEmail('user-1');

      expect(result).toBe('alice@example.com');
    });

    it('should return null when user not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.getEmail('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────
  // getPhone()
  // ──────────────────────────────────────────────────────────

  describe('getPhone', () => {
    it('should return phone when user exists', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ phone: '+15551234567' }]);

      const result = await service.getPhone('user-1');

      expect(result).toBe('+15551234567');
    });

    it('should return null when user not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.getPhone('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when user has no phone', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ phone: null }]);

      const result = await service.getPhone('user-1');

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────
  // toSnapshot (tested indirectly through event payloads)
  // ──────────────────────────────────────────────────────────

  describe('toSnapshot (via event payloads)', () => {
    it('should include all snapshot fields in created event', async () => {
      rbacService.findRoleById.mockResolvedValueOnce({ id: 'role-1', name: 'Admin', userType: 'admin' });
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const newUser = makeUserRow({
        id: 'user-new',
        email: 'snap@example.com',
        phone: '+15550001111',
        firstName: 'Snap',
        lastName: 'Shot',
        userType: 'admin',
      });

      mockDb.transaction.mockImplementation(async (fn: any) => {
        const txChain = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([newUser]),
            }),
          }),
        };
        return fn(txChain);
      });

      await service.create(
        {
          email: 'snap@example.com',
          phone: '+15550001111',
          firstName: 'Snap',
          lastName: 'Shot',
          password: 'pass123',
          userType: 'admin',
          roleIds: ['role-1'],
        },
        'actor-1',
      );

      const emitCall = eventEmitter.emit.mock.calls[0];
      const snapshot = emitCall[1].payload.after;

      expect(snapshot).toEqual({
        email: 'snap@example.com',
        phone: '+15550001111',
        firstName: 'Snap',
        lastName: 'Shot',
        userType: 'admin',
      });
    });

    it('should include before and after snapshots in update event', async () => {
      const existing = makeUserRow({ firstName: 'Alice', lastName: 'Smith' });
      mockDb._chain.limit.mockResolvedValueOnce([existing]);

      const updated = makeUserRow({ firstName: 'Alicia', lastName: 'Smith' });
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      await service.update('user-1', { firstName: 'Alicia' }, 'actor-1');

      const emitCall = eventEmitter.emit.mock.calls[0];
      const { before, after } = emitCall[1].payload;

      expect(before.firstName).toBe('Alice');
      expect(after.firstName).toBe('Alicia');
      // Unchanged fields preserved
      expect(before.lastName).toBe('Smith');
      expect(after.lastName).toBe('Smith');
    });
  });
});
