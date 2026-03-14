import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@packages/database/schema';
import { identities, users, eq } from '@packages/database';
import { hashPassword } from '@packages/auth';
import { UsersService } from '../users.service';
import { USERS_USER_CREATED, USERS_USER_UPDATED, USERS_USER_DELETED } from '../../events/types';
import { UserFactory } from '../../../../../../../test/factories/userFactory';
import { cleanDatabase } from '../../../../../../../test/utils/db';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://dev:dev@localhost:5432/starter';
const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

let identityCounter = 0;

function createMockAuthService() {
  return {
    register: vi.fn(async (email: string, _password: string) => {
      identityCounter++;
      const passwordHash = await hashPassword(_password);
      const [identity] = await db
        .insert(identities)
        .values({ email: email.toLowerCase(), passwordHash })
        .returning();
      return {
        accessToken: `mock-access-token-${identityCounter}`,
        refreshToken: `mock-refresh-token-${identityCounter}`,
        identity: { id: identity.id, email: identity.email },
      };
    }),
    logout: vi.fn(async (identityId: string) => {
      await db
        .update(identities)
        .set({ refreshToken: null })
        .where(eq(identities.id, identityId));
    }),
  };
}

const mockEventEmitter = {
  emit: vi.fn(),
};

// Create a mock DatabaseService that wraps our db instance
function createMockDatabaseService() {
  return { db };
}

describe('UsersService', () => {
  let service: UsersService;
  let mockAuthService: ReturnType<typeof createMockAuthService>;

  beforeAll(async () => {
    // Pool connects lazily, test with a query
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    await cleanDatabase(db);
    await pool.end();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    mockEventEmitter.emit.mockClear();
    mockAuthService = createMockAuthService();
    service = new UsersService(
      createMockDatabaseService() as any,
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
      }, 'admin-actor-id');

      expect(mockAuthService.register).toHaveBeenCalledWith('test@example.com', 'Password123!');
      expect(result.user).toMatchObject({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+15551234567',
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const [dbUser] = await db.select().from(users).where(eq(users.firstName, 'John')).limit(1);
      expect(dbUser).not.toBeNull();

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_CREATED,
        expect.objectContaining({
          actorId: 'admin-actor-id',
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
      }, null);

      mockAuthService.register.mockRejectedValueOnce(new ConflictException('Email already registered'));

      await expect(
        service.create({
          email: 'dup@example.com',
          password: 'Password123!',
          firstName: 'Second',
          lastName: 'User',
        }, null),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      await UserFactory.create(db, { firstName: 'Alice' });
      await UserFactory.create(db, { firstName: 'Bob' });
      await UserFactory.create(db, { firstName: 'Charlie' });

      const result = await service.findAll({ page: 1, limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(3);
      expect(result.meta.totalPages).toBe(2);
    });

    it('should search by firstName, lastName, and email', async () => {
      await UserFactory.create(db, { firstName: 'Alice', lastName: 'Smith' });
      await UserFactory.create(db, { firstName: 'Bob', lastName: 'Johnson' });

      const byFirst = await service.findAll({ search: 'Alice' });
      expect(byFirst.data).toHaveLength(1);
      expect(byFirst.data[0].firstName).toBe('Alice');

      const byLast = await service.findAll({ search: 'Johnson' });
      expect(byLast.data).toHaveLength(1);
      expect(byLast.data[0].lastName).toBe('Johnson');
    });

    it('should exclude soft-deleted users', async () => {
      const user = await UserFactory.create(db);
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));

      const result = await service.findAll({});
      expect(result.data.find((u) => u.id === user.id)).toBeUndefined();
    });

    it('should sort by createdAt desc by default', async () => {
      await UserFactory.create(db, { firstName: 'First' });
      await new Promise((r) => setTimeout(r, 10));
      await UserFactory.create(db, { firstName: 'Second' });

      const result = await service.findAll({});
      expect(result.data[0].firstName).toBe('Second');
      expect(result.data[1].firstName).toBe('First');
    });
  });

  describe('findOneOrFail', () => {
    it('should return user with email', async () => {
      const created = await UserFactory.create(db, {
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
      const user = await UserFactory.create(db);
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));

      await expect(service.findOneOrFail(user.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update profile fields and emit event', async () => {
      const user = await UserFactory.create(db, {
        firstName: 'Old',
        lastName: 'Name',
      });

      const result = await service.update(user.id, {
        firstName: 'New',
        lastName: 'Name',
        phone: '+15559876543',
        timezone: 'America/New_York',
      }, 'admin-actor-id');

      expect(result).toMatchObject({
        firstName: 'New',
        phone: '+15559876543',
        timezone: 'America/New_York',
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_UPDATED,
        expect.objectContaining({
          entityId: user.id,
          actorId: 'admin-actor-id',
          payload: expect.objectContaining({
            updatedFields: expect.arrayContaining(['firstName', 'lastName', 'phone', 'timezone']),
          }),
        }),
      );
    });

    it('should throw NotFoundException for nonexistent user', async () => {
      await expect(
        service.update('00000000-0000-0000-0000-000000000000', { firstName: 'Nope' }, 'actor'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for soft-deleted user', async () => {
      const user = await UserFactory.create(db);
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));

      await expect(service.update(user.id, { firstName: 'Nope' }, 'actor')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt and delegate refresh token invalidation to AuthService', async () => {
      const user = await UserFactory.create(db);

      await service.softDelete(user.id, 'admin-actor-id');

      const [dbUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      expect(dbUser!.deletedAt).not.toBeNull();

      expect(mockAuthService.logout).toHaveBeenCalledWith(user.identityId);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        USERS_USER_DELETED,
        expect.objectContaining({
          entityId: user.id,
          actorId: 'admin-actor-id',
          payload: expect.objectContaining({ email: user.identity.email }),
        }),
      );
    });

    it('should not emit event on failure', async () => {
      await expect(
        service.softDelete('00000000-0000-0000-0000-000000000000', 'actor'),
      ).rejects.toThrow(NotFoundException);

      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for already-deleted user', async () => {
      const user = await UserFactory.create(db);
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));

      await expect(service.softDelete(user.id, 'actor')).rejects.toThrow(NotFoundException);
    });
  });
});
