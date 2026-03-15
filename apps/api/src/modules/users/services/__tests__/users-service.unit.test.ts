import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users.service';

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
    getUserTypes: vi.fn().mockResolvedValue([]),
    assignUserType: vi.fn().mockResolvedValue(undefined),
  } as any;
}

const now = new Date('2026-01-01T00:00:00Z');

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
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

  beforeEach(() => {
    mockDb = createMockDb();
    mockAuthService = createMockAuthService();
    mockRbacService = createMockRbacService();
    const databaseService = createMockDatabaseService(mockDb);
    service = new UsersService(mockAuthService, mockRbacService, databaseService);
  });

  describe('findOneOrFail', () => {
    it('should return user with user types when found', async () => {
      const user = buildUser();
      mockDb._chain.limit.mockResolvedValueOnce([user]);
      mockRbacService.getUserTypes.mockResolvedValueOnce(['admin', 'client']);

      const result = await service.findOneOrFail('user-1');

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: now,
        updatedAt: now,
        userTypes: ['admin', 'client'],
      });
      expect(mockRbacService.getUserTypes).toHaveBeenCalledWith('user-1');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findOneOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create user with credential and user types in a transaction', async () => {
      const user = buildUser();

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
          userTypes: ['admin', 'client'],
        },
        'actor-1',
      );

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.userTypes).toEqual(['admin', 'client']);

      // Verify credential was created
      expect(mockAuthService.createPasswordCredential).toHaveBeenCalledWith(
        'user-1',
        'test@example.com',
        'Password123!',
        mockTx,
      );

      // Verify user types were assigned
      expect(mockRbacService.assignUserType).toHaveBeenCalledTimes(2);
      expect(mockRbacService.assignUserType).toHaveBeenCalledWith('user-1', 'admin', mockTx);
      expect(mockRbacService.assignUserType).toHaveBeenCalledWith('user-1', 'client', mockTx);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ id: 'existing-user' }]);

      await expect(
        service.create(
          {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            password: 'Password123!',
            userTypes: ['admin'],
          },
          'actor-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should lowercase the email', async () => {
      const user = buildUser({ email: 'test@example.com' });
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
          userTypes: ['admin'],
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

      // findOneOrFail mock: select → limit returns user, then getUserTypes
      mockDb._chain.limit.mockResolvedValueOnce([existingUser]);
      mockRbacService.getUserTypes.mockResolvedValueOnce(['admin']);

      // update → returning
      mockDb._chain.returning.mockResolvedValueOnce([updatedUser]);

      const result = await service.update('user-1', { firstName: 'Jane' }, 'actor-1');

      expect(result.firstName).toBe('Jane');
      expect(mockDb.update).toHaveBeenCalled();
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
      mockRbacService.getUserTypes.mockResolvedValueOnce(['admin']);

      await expect(
        service.update('user-1', { email: 'taken@example.com' }, 'actor-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should return existing user unchanged if no fields provided', async () => {
      const existingUser = buildUser();
      mockDb._chain.limit.mockResolvedValueOnce([existingUser]);
      mockRbacService.getUserTypes.mockResolvedValueOnce(['admin']);

      const result = await service.update('user-1', {}, 'actor-1');

      expect(result.id).toBe('user-1');
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt and deletedBy', async () => {
      const existingUser = buildUser();
      mockDb._chain.limit.mockResolvedValueOnce([existingUser]);
      mockRbacService.getUserTypes.mockResolvedValueOnce(['admin']);

      await service.softDelete('user-1', 'actor-1');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.softDelete('nonexistent', 'actor-1'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('should return paginated users with user types', async () => {
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
        // userTypes query (loadUserTypesMap)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { userId: 'user-1', userType: 'admin' },
            ]),
          }),
        });

      const result = await service.list({ page: 1, limit: 25 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].userTypes).toEqual(['admin']);
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
