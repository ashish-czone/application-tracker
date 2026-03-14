import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDB } from '@packages/database';
import { users, identities, permissions, roles, rolePermissions, eq, and } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { tokenFor } from '../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../test/factories/identityFactory';
import { UserFactory } from '../../../../../../../test/factories/userFactory';

async function upsertPermission(db: DrizzleDB, resource: string, action: string) {
  const [existing] = await db.select().from(permissions)
    .where(and(eq(permissions.resource, resource), eq(permissions.action, action))).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(permissions).values({ resource, action }).returning();
  return created;
}

async function upsertRolePermission(db: DrizzleDB, roleId: string, permissionId: string) {
  await db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
}

describe('Users API — integration', () => {
  let app: INestApplication;
  let db: DrizzleDB;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    db = testApp.db;
    httpServer = testApp.httpServer;
  });

  afterAll(async () => {
    await cleanDatabase(db);
    await app.close();
  });

  describe('POST /api/v1/users/register', () => {
    it('should create user + identity and return accessToken with refresh cookie', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/register')
        .send({
          email: 'register@example.com',
          password: 'Password123!',
          firstName: 'Register',
          lastName: 'Test',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user).toMatchObject({
        email: 'register@example.com',
        firstName: 'Register',
        lastName: 'Test',
      });

      // Refresh cookie
      const cookies = res.headers['set-cookie'];
      const arr = Array.isArray(cookies) ? cookies : [cookies];
      const refreshCookie = arr.find((c: string) => c.startsWith('user_refresh_token='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');

      // Verify DB state
      const [dbUser] = await db
        .select({ id: users.id, firstName: users.firstName, email: identities.email })
        .from(users)
        .innerJoin(identities, eq(users.identityId, identities.id))
        .where(eq(users.firstName, 'Register'))
        .limit(1);
      expect(dbUser).not.toBeNull();
      expect(dbUser!.email).toBe('register@example.com');
    });

    it('should return 409 for duplicate email', async () => {
      // Reuses 'register@example.com' created by the previous test
      const res = await request(httpServer)
        .post('/api/v1/users/register')
        .send({
          email: 'register@example.com',
          password: 'Password123!',
          firstName: 'Second',
          lastName: 'User',
        });

      expect(res.status).toBe(409);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/register')
        .send({ email: 'incomplete@example.com', password: 'Password123!' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/register')
        .send({
          email: 'not-an-email',
          password: 'Password123!',
          firstName: 'Bad',
          lastName: 'Email',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for short password', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/register')
        .send({
          email: 'short-pw@example.com',
          password: 'short',
          firstName: 'Short',
          lastName: 'Pass',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/users', () => {
    it('should create a user (admin flow)', async () => {
      const admin = await IdentityFactory.createWithRole(db, 'superadmin');
      const perm = await upsertPermission(db, 'users', 'create');
      const [role] = await db.select().from(roles).where(eq(roles.name, 'superadmin')).limit(1);
      await upsertRolePermission(db, role!.id, perm.id);

      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({
          email: 'admin-created@example.com',
          password: 'Password123!',
          firstName: 'Admin',
          lastName: 'Created',
          phone: '+15551234567',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        email: 'admin-created@example.com',
        firstName: 'Admin',
        lastName: 'Created',
        phone: '+15551234567',
      });
      expect(res.body).not.toHaveProperty('accessToken');
    });
  });

  describe('GET /api/v1/users', () => {
    it('should return paginated list of users', async () => {
      const admin = await IdentityFactory.createWithRole(db, 'superadmin');
      const perm = await upsertPermission(db, 'users', 'read');
      const [role] = await db.select().from(roles).where(eq(roles.name, 'superadmin')).limit(1);
      await upsertRolePermission(db, role!.id, perm.id);

      await UserFactory.create(db, { firstName: 'ListUser1' });
      await UserFactory.create(db, { firstName: 'ListUser2' });

      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should search users by name', async () => {
      const admin = await IdentityFactory.createWithRole(db, 'superadmin');
      const perm = await upsertPermission(db, 'users', 'read');
      const [role] = await db.select().from(roles).where(eq(roles.name, 'superadmin')).limit(1);
      await upsertRolePermission(db, role!.id, perm.id);

      await UserFactory.create(db, { firstName: 'SearchableUniqueZZZ' });

      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .query({ search: 'SearchableUniqueZZZ' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].firstName).toBe('SearchableUniqueZZZ');
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return a single user', async () => {
      const admin = await IdentityFactory.createWithRole(db, 'superadmin');
      const perm = await upsertPermission(db, 'users', 'read');
      const [role] = await db.select().from(roles).where(eq(roles.name, 'superadmin')).limit(1);
      await upsertRolePermission(db, role!.id, perm.id);

      const user = await UserFactory.create(db, { firstName: 'Detail', lastName: 'User' });

      const res = await request(httpServer)
        .get(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: user.id,
        firstName: 'Detail',
        lastName: 'User',
      });
    });

    it('should return 404 for nonexistent user', async () => {
      const admin = await IdentityFactory.createWithRole(db, 'superadmin');
      const perm = await upsertPermission(db, 'users', 'read');
      const [role] = await db.select().from(roles).where(eq(roles.name, 'superadmin')).limit(1);
      await upsertRolePermission(db, role!.id, perm.id);

      const res = await request(httpServer)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('should update user profile fields', async () => {
      const admin = await IdentityFactory.createWithRole(db, 'superadmin');
      const perm = await upsertPermission(db, 'users', 'update');
      const [role] = await db.select().from(roles).where(eq(roles.name, 'superadmin')).limit(1);
      await upsertRolePermission(db, role!.id, perm.id);

      const user = await UserFactory.create(db, { firstName: 'Before' });

      const res = await request(httpServer)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ firstName: 'After', timezone: 'America/New_York' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('After');
      expect(res.body.timezone).toBe('America/New_York');
    });

    it('should reject unknown properties', async () => {
      const admin = await IdentityFactory.createWithRole(db, 'superadmin');
      const perm = await upsertPermission(db, 'users', 'update');
      const [role] = await db.select().from(roles).where(eq(roles.name, 'superadmin')).limit(1);
      await upsertRolePermission(db, role!.id, perm.id);

      const user = await UserFactory.create(db);

      const res = await request(httpServer)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ email: 'hacked@example.com', password: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should soft-delete a user', async () => {
      const admin = await IdentityFactory.createWithRole(db, 'superadmin');
      const perm = await upsertPermission(db, 'users', 'delete');
      const [role] = await db.select().from(roles).where(eq(roles.name, 'superadmin')).limit(1);
      await upsertRolePermission(db, role!.id, perm.id);

      const user = await UserFactory.create(db);

      const res = await request(httpServer)
        .delete(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(204);

      // Verify soft-deleted
      const [dbUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      expect(dbUser!.deletedAt).not.toBeNull();
    });
  });
});
