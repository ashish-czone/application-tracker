import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users.service';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

// Mock database helpers
function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
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

function createMockDatabaseService(mockDb: ReturnType<typeof createMockDb>) {
  return { db: mockDb } as any;
}

function createMockAuthService() {
  return {
    createPasswordCredential: vi.fn().mockResolvedValue({
      id: 'cred-1',
      userId: 'user-1',
      provider: 'password',
      identifier: 'test@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  } as any;
}

function createMockRbacService() {
  return {
    findRoleById: vi.fn().mockResolvedValue(null),
    assignRoleToUser: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockEventEmitter() {
  return {
    emit: vi.fn(),
  } as any;
}

const now = new Date('2026-01-01T00:00:00Z');

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    phone: null,
    firstName: 'John',
    lastName: 'Doe',
    userType: 'admin',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockAuthService: ReturnType<typeof createMockAuthService>;
  let mockRbacService: ReturnType<typeof createMockRbacService>;
  let mockEventEmitter: ReturnType<typeof createMockEventEmitter>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockAuthService = createMockAuthService();
    mockRbacService = createMockRbacService();
    mockEventEmitter = createMockEventEmitter();
    const databaseService = createMockDatabaseService(mockDb);
    service = new UsersService(mockAuthService, mockRbacService, databaseService, mockEventEmitter, createMockAppLogger());
  });

  describe('findOneOrFail', () => {
    it('should return user with userType when found', async () => {
      const user = buildUser();
      mockDb._chain.limit.mockResolvedValueOnce([user]);

      const result = await service.findOneOrFail('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        phone: null,
        firstName: 'John',
        lastName: 'Doe',
        userType: 'admin',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        roles: [],
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findOneOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const adminRole = { id: 'role-1', name: 'admin', userType: 'admin', isDefault: true, createdAt: now, updatedAt: now };

    it('should create user with credential, assign role, and emit event', async () => {
      const user = buildUser();
      mockRbacService.findRoleById.mockResolvedValueOnce(adminRole);

      // No existing user with same email
      mockDb._chain.limit.mockResolvedValueOnce([]);

      // Mock transaction — execute the callback with a mock tx
      const mockTx = createMockDb();
      mockTx._chain.returning.mockResolvedValueOnce([user]);
      mockDb.transaction.mockImplementationOnce(async (cb: any) => cb(mockTx));

      const result = await service.create(
        {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          password: 'Password123!',
          userType: 'admin',
          roleIds: ['role-1'],
        },
        'actor-1',
      );

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.userType).toBe('admin');

      // Verify credential was created
      expect(mockAuthService.createPasswordCredential).toHaveBeenCalledWith(
        'user-1',
        'test@example.com',
        'Password123!',
        mockTx,
      );

      // Verify role was assigned
      expect(mockRbacService.assignRoleToUser).toHaveBeenCalledWith('user-1', 'role-1');

      // Verify event emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('users.UserCreated', {
        entityType: 'users',
        entityId: 'user-1',
        actorId: 'actor-1',
        payload: {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          userType: 'admin',
          after: expect.objectContaining({
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            userType: 'admin',
          }),
        },
      });
    });

    it('should throw NotFoundException if role does not exist', async () => {
      mockRbacService.findRoleById.mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            password: 'Password123!',
            userType: 'admin',
            roleIds: ['nonexistent'],
          },
          'actor-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if role userType does not match', async () => {
      const clientRole = { id: 'role-2', name: 'client', userType: 'client', isDefault: true, createdAt: now, updatedAt: now };
      mockRbacService.findRoleById.mockResolvedValueOnce(clientRole);

      await expect(
        service.create(
          {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            password: 'Password123!',
            userType: 'admin',
            roleIds: ['role-2'],
          },
          'actor-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockRbacService.findRoleById.mockResolvedValueOnce(adminRole);
      mockDb._chain.limit.mockResolvedValueOnce([{ id: 'existing-user' }]);

      await expect(
        service.create(
          {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            password: 'Password123!',
            userType: 'admin',
            roleIds: ['role-1'],
          },
          'actor-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should lowercase the email', async () => {
      const user = buildUser({ email: 'test@example.com' });
      mockRbacService.findRoleById.mockResolvedValueOnce(adminRole);
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const mockTx = createMockDb();
      mockTx._chain.returning.mockResolvedValueOnce([user]);
      mockDb.transaction.mockImplementationOnce(async (cb: any) => cb(mockTx));

      await service.create(
        {
          email: 'TEST@EXAMPLE.COM',
          firstName: 'John',
          lastName: 'Doe',
          password: 'Password123!',
          userType: 'admin',
          roleIds: ['role-1'],
        },
        'actor-1',
      );

      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockAuthService.createPasswordCredential).toHaveBeenCalledWith(
        'user-1',
        'test@example.com',
        'Password123!',
        mockTx,
      );
    });
  });

  describe('update', () => {
    it('should update user fields and return updated user', async () => {
      const existingUser = buildUser();
      const updatedUser = buildUser({ firstName: 'Jane' });

      // findOneOrFail mock: select → limit returns user
      mockDb._chain.limit.mockResolvedValueOnce([existingUser]);

      // update → returning
      mockDb._chain.returning.mockResolvedValueOnce([updatedUser]);

      const result = await service.update('user-1', { firstName: 'Jane' }, 'actor-1');

      expect(result.firstName).toBe('Jane');
      expect(mockDb.update).toHaveBeenCalled();

      // Verify event emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('users.UserUpdated', {
        entityType: 'users',
        entityId: 'user-1',
        actorId: 'actor-1',
        payload: {
          changes: ['firstName'],
          before: expect.objectContaining({ firstName: 'John' }),
          after: expect.objectContaining({ firstName: 'Jane' }),
        },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.update('nonexistent', { firstName: 'Jane' }, 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if email is taken by another user', async () => {
      const existingUser = buildUser();
      mockDb._chain.limit
        .mockResolvedValueOnce([existingUser])  // findOneOrFail
        .mockResolvedValueOnce([{ id: 'other-user' }]);  // email uniqueness check

      await expect(
        service.update('user-1', { email: 'taken@example.com' }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should return existing user unchanged if no fields provided', async () => {
      const existingUser = buildUser();
      mockDb._chain.limit.mockResolvedValueOnce([existingUser]);

      const result = await service.update('user-1', {}, 'actor-1');

      expect(result.id).toBe('user-1');
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt and deletedBy', async () => {
      const existingUser = buildUser();
      mockDb._chain.limit.mockResolvedValueOnce([existingUser]);

      await service.softDelete('user-1', 'actor-1');

      expect(mockDb.update).toHaveBeenCalled();

      // Verify event emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('users.UserDeleted', {
        entityType: 'users',
        entityId: 'user-1',
        actorId: 'actor-1',
        payload: {
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          before: expect.objectContaining({
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          }),
        },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent', 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('should return paginated users with userType', async () => {
      const user = buildUser();

      // count query
      mockDb._chain.where.mockReturnThis();
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 1 }]),
          }),
        })
        // data query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([user]),
                }),
              }),
            }),
          }),
        })
        // roles batch-load query
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        });

      const result = await service.list({ page: 1, limit: 25 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].userType).toBe('admin');
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
    });

    it('should return empty data when no users found', async () => {
      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ total: 0 }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        });

      const result = await service.list({});

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });
});
