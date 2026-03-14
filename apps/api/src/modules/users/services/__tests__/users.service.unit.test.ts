import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@packages/database';
import { hashPassword } from '@packages/auth';
import { UsersService } from '../users.service';
import { USERS_USER_CREATED, USERS_USER_UPDATED, USERS_USER_DELETED } from '../../events/types';
import { UserFactory } from '../../../../../../../test/factories/userFactory';
import { cleanDatabase } from '../../../../../../../test/utils/db';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/starter';
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

let identityCounter = 0;

function createMockAuthService() {
  return {
    register: vi.fn(async (email: string, _password: string) => {
      identityCounter++;
      const passwordHash = await hashPassword(_password);
      const identity = await prisma.identity.create({
        data: { email: email.toLowerCase(), passwordHash },
      });
      return {
        accessToken: `mock-access-token-${identityCounter}`,
        refreshToken: `mock-refresh-token-${identityCounter}`,
        identity: { id: identity.id, email: identity.email },
      };
    }),
    logout: vi.fn(async (identityId: string) => {
      await prisma.identity.update({
        where: { id: identityId },
        data: { refreshToken: null },
      });
    }),
  };
}

const mockEventEmitter = {
  emit: vi.fn(),
};

describe('UsersService', () => {
  let service: UsersService;
  let mockAuthService: ReturnType<typeof createMockAuthService>;

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
    mockAuthService = createMockAuthService();
    service = new UsersService(
      prisma as any,
      mockAuthService as any,
      mockEventEmitter as any,
    );
  });

  describe('create', () => {
    it('should delegate identity creation to AuthService and create user', async () => {
      const result = await service.create({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+15551234567',
      });

      expect(mockAuthService.register).toHaveBeenCalledWith('test@example.com', 'Password123!');
      expect(result.user).toMatchObject({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+15551234567',
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const dbUser = await prisma.user.findFirst({ where: { firstName: 'John' } });
      expect(dbUser).not.toBeNull();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_CREATED,
        expect.objectContaining({
          payload: expect.objectContaining({ firstName: 'John', email: 'test@example.com' }),
        }),
      );
    });

    it('should propagate ConflictException from AuthService for duplicate email', async () => {
      await service.create({
        email: 'dup@example.com',
        password: 'Password123!',
        firstName: 'First',
        lastName: 'User',
      });

      mockAuthService.register.mockRejectedValueOnce(new ConflictException('Email already registered'));

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

      await expect(service.findOneOrFail(user.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update profile fields and emit event', async () => {
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
        service.update('00000000-0000-0000-0000-000000000000', { firstName: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for soft-deleted user', async () => {
      const user = await UserFactory.create(prisma);
      await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

      await expect(service.update(user.id, { firstName: 'Nope' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt and delegate refresh token invalidation to AuthService', async () => {
      const user = await UserFactory.create(prisma);

      await service.softDelete(user.id);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser!.deletedAt).not.toBeNull();

      expect(mockAuthService.logout).toHaveBeenCalledWith(user.identityId);

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
      await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

      await expect(service.softDelete(user.id)).rejects.toThrow(NotFoundException);
    });
  });
});
