import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@packages/database';
import { UsersService } from '../users.service';
import { USERS_USER_CREATED, USERS_USER_UPDATED, USERS_USER_DELETED } from '../../events/types';
import { UserFactory } from '../../../../../../../test/factories/userFactory';
import { cleanDatabase } from '../../../../../../../test/utils/db';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/starter';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-user-secret';
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

const mockRbacService = {
  bootstrapSuperadmin: async () => {},
  getIdentityPermissions: async () => [],
};

const mockSettingsService = {
  get: async (_module: string, _key: string, defaultValue: string) => defaultValue,
};

const mockEventEmitter = {
  emit: vi.fn(),
};

function createService() {
  return new UsersService(
    prisma as any,
    mockRbacService as any,
    mockSettingsService as any,
    mockEventEmitter as any,
  );
}

describe('UsersService', () => {
  let service: UsersService;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    mockEventEmitter.emit.mockClear();
    service = createService();
  });

  describe('register', () => {
    it('should create identity + user and return tokens', async () => {
      const result = await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.user).toMatchObject({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      // Verify DB state
      const dbUser = await prisma.user.findFirst({
        where: { firstName: 'John' },
        include: { identity: true },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.identity.email).toBe('test@example.com');
      expect(dbUser!.identity.passwordHash).not.toBe('Password123!');

      // Verify event emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_CREATED,
        expect.objectContaining({
          eventName: USERS_USER_CREATED,
          entityType: 'user',
          payload: expect.objectContaining({
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
            registeredSelf: true,
          }),
        }),
      );
    });

    it('should lowercase email', async () => {
      const result = await service.register({
        email: 'Test@Example.COM',
        password: 'Password123!',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw ConflictException for duplicate email', async () => {
      await service.register({
        email: 'dup@example.com',
        password: 'Password123!',
        firstName: 'First',
        lastName: 'User',
      });

      await expect(
        service.register({
          email: 'dup@example.com',
          password: 'Password123!',
          firstName: 'Second',
          lastName: 'User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('create', () => {
    it('should create identity + user without tokens', async () => {
      const result = await service.create({
        email: 'admin-created@example.com',
        password: 'Password123!',
        firstName: 'Admin',
        lastName: 'Created',
        phone: '+15551234567',
      });

      expect(result).toMatchObject({
        email: 'admin-created@example.com',
        firstName: 'Admin',
        lastName: 'Created',
        phone: '+15551234567',
      });
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');

      // Verify event emitted with registeredSelf: false
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_CREATED,
        expect.objectContaining({
          payload: expect.objectContaining({ registeredSelf: false }),
        }),
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      await service.create({
        email: 'dup@example.com',
        password: 'Password123!',
        firstName: 'First',
        lastName: 'User',
      });

      await expect(
        service.create({
          email: 'dup@example.com',
          password: 'Password123!',
          firstName: 'Second',
          lastName: 'User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      await UserFactory.create(prisma, { firstName: 'Alice' });
      await UserFactory.create(prisma, { firstName: 'Bob' });
      await UserFactory.create(prisma, { firstName: 'Charlie' });

      const result = await service.findAll({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(3);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should search by firstName, lastName, and email', async () => {
      await UserFactory.create(prisma, { firstName: 'Alice', lastName: 'Smith' });
      await UserFactory.create(prisma, { firstName: 'Bob', lastName: 'Johnson' });

      const byFirst = await service.findAll({ search: 'Alice' });
      expect(byFirst.data).toHaveLength(1);
      expect(byFirst.data[0].firstName).toBe('Alice');

      const byLast = await service.findAll({ search: 'Johnson' });
      expect(byLast.data).toHaveLength(1);
      expect(byLast.data[0].lastName).toBe('Johnson');
    });

    it('should exclude soft-deleted users', async () => {
      const user = await UserFactory.create(prisma);
      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date() },
      });

      const result = await service.findAll({});
      expect(result.data.find((u) => u.id === user.id)).toBeUndefined();
    });

    it('should sort by createdAt desc by default', async () => {
      await UserFactory.create(prisma, { firstName: 'First' });
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      await UserFactory.create(prisma, { firstName: 'Second' });

      const result = await service.findAll({});
      expect(result.data[0].firstName).toBe('Second');
      expect(result.data[1].firstName).toBe('First');
    });
  });

  describe('findOneOrFail', () => {
    it('should return user with email', async () => {
      const created = await UserFactory.create(prisma, {
        firstName: 'Found',
        lastName: 'User',
      });

      const result = await service.findOneOrFail(created.id);

      expect(result).toMatchObject({
        id: created.id,
        firstName: 'Found',
        lastName: 'User',
        email: created.identity.email,
      });
    });

    it('should throw NotFoundException for nonexistent id', async () => {
      await expect(
        service.findOneOrFail('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for soft-deleted user', async () => {
      const user = await UserFactory.create(prisma);
      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date() },
      });

      await expect(service.findOneOrFail(user.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update profile fields', async () => {
      const user = await UserFactory.create(prisma, {
        firstName: 'Old',
        lastName: 'Name',
      });

      const result = await service.update(user.id, {
        firstName: 'New',
        lastName: 'Name',
        phone: '+15559876543',
        timezone: 'America/New_York',
      });

      expect(result).toMatchObject({
        firstName: 'New',
        lastName: 'Name',
        phone: '+15559876543',
        timezone: 'America/New_York',
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_UPDATED,
        expect.objectContaining({
          entityId: user.id,
          payload: expect.objectContaining({
            updatedFields: expect.arrayContaining(['firstName', 'lastName', 'phone', 'timezone']),
          }),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent user', async () => {
      await expect(
        service.update('00000000-0000-0000-0000-000000000000', {
          firstName: 'Nope',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for soft-deleted user', async () => {
      const user = await UserFactory.create(prisma);
      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date() },
      });

      await expect(
        service.update(user.id, { firstName: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt on user and clear refresh token on identity', async () => {
      const user = await UserFactory.create(prisma);

      await service.softDelete(user.id);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser!.deletedAt).not.toBeNull();

      const dbIdentity = await prisma.identity.findUnique({
        where: { id: user.identityId },
      });
      expect(dbIdentity!.refreshToken).toBeNull();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_DELETED,
        expect.objectContaining({
          entityId: user.id,
          payload: expect.objectContaining({ email: user.identity.email }),
        }),
      );
    });

    it('should not emit event on failure', async () => {
      await expect(
        service.softDelete('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for already-deleted user', async () => {
      const user = await UserFactory.create(prisma);
      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date() },
      });

      await expect(service.softDelete(user.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
