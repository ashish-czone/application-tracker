import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { tokenFor } from '../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../test/factories/identityFactory';
import { UserFactory } from '../../../../../../../test/factories/userFactory';

describe('Users API — integration', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    httpServer = testApp.httpServer;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
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
      const dbUser = await prisma.user.findFirst({
        where: { firstName: 'Register' },
        include: { identity: true },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.identity.email).toBe('register@example.com');
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
      const admin = await IdentityFactory.createWithRole(prisma, 'superadmin');
      await prisma.permission.upsert({
        where: { resource_action: { resource: 'users', action: 'create' } },
        update: {},
        create: { resource: 'users', action: 'create' },
      });
      const perm = await prisma.permission.findUnique({
        where: { resource_action: { resource: 'users', action: 'create' } },
      });
      const role = await prisma.role.findUnique({ where: { name: 'superadmin' } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role!.id, permissionId: perm!.id } },
        update: {},
        create: { roleId: role!.id, permissionId: perm!.id },
      });

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
      const admin = await IdentityFactory.createWithRole(prisma, 'superadmin');
      // Grant read permission
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: 'users', action: 'read' } },
        update: {},
        create: { resource: 'users', action: 'read' },
      });
      const role = await prisma.role.findUnique({ where: { name: 'superadmin' } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role!.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role!.id, permissionId: perm.id },
      });

      await UserFactory.create(prisma, { firstName: 'ListUser1' });
      await UserFactory.create(prisma, { firstName: 'ListUser2' });

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
      const admin = await IdentityFactory.createWithRole(prisma, 'superadmin');
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: 'users', action: 'read' } },
        update: {},
        create: { resource: 'users', action: 'read' },
      });
      const role = await prisma.role.findUnique({ where: { name: 'superadmin' } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role!.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role!.id, permissionId: perm.id },
      });

      await UserFactory.create(prisma, { firstName: 'SearchableUniqueZZZ' });

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
      const admin = await IdentityFactory.createWithRole(prisma, 'superadmin');
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: 'users', action: 'read' } },
        update: {},
        create: { resource: 'users', action: 'read' },
      });
      const role = await prisma.role.findUnique({ where: { name: 'superadmin' } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role!.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role!.id, permissionId: perm.id },
      });

      const user = await UserFactory.create(prisma, { firstName: 'Detail', lastName: 'User' });

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
      const admin = await IdentityFactory.createWithRole(prisma, 'superadmin');
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: 'users', action: 'read' } },
        update: {},
        create: { resource: 'users', action: 'read' },
      });
      const role = await prisma.role.findUnique({ where: { name: 'superadmin' } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role!.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role!.id, permissionId: perm.id },
      });

      const res = await request(httpServer)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('should update user profile fields', async () => {
      const admin = await IdentityFactory.createWithRole(prisma, 'superadmin');
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: 'users', action: 'update' } },
        update: {},
        create: { resource: 'users', action: 'update' },
      });
      const role = await prisma.role.findUnique({ where: { name: 'superadmin' } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role!.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role!.id, permissionId: perm.id },
      });

      const user = await UserFactory.create(prisma, { firstName: 'Before' });

      const res = await request(httpServer)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ firstName: 'After', timezone: 'America/New_York' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('After');
      expect(res.body.timezone).toBe('America/New_York');
    });

    it('should reject unknown properties', async () => {
      const admin = await IdentityFactory.createWithRole(prisma, 'superadmin');
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: 'users', action: 'update' } },
        update: {},
        create: { resource: 'users', action: 'update' },
      });
      const role = await prisma.role.findUnique({ where: { name: 'superadmin' } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role!.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role!.id, permissionId: perm.id },
      });

      const user = await UserFactory.create(prisma);

      const res = await request(httpServer)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ email: 'hacked@example.com', password: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should soft-delete a user', async () => {
      const admin = await IdentityFactory.createWithRole(prisma, 'superadmin');
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: 'users', action: 'delete' } },
        update: {},
        create: { resource: 'users', action: 'delete' },
      });
      const role = await prisma.role.findUnique({ where: { name: 'superadmin' } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role!.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role!.id, permissionId: perm.id },
      });

      const user = await UserFactory.create(prisma);

      const res = await request(httpServer)
        .delete(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(204);

      // Verify soft-deleted
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser!.deletedAt).not.toBeNull();
    });
  });
});
