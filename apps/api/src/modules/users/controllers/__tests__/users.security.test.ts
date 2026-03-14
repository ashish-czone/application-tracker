import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { tokenFor, expiredTokenFor } from '../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../test/factories/identityFactory';
import { UserFactory } from '../../../../../../../test/factories/userFactory';

describe('Users API — security', () => {
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

  describe('GET /api/v1/users — auth', () => {
    it('should return 401 without token', async () => {
      const res = await request(httpServer).get('/api/v1/users');
      expect(res.status).toBe(401);
    });

    it('should return 401 with expired token', async () => {
      const identity = await IdentityFactory.create(prisma);
      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${expiredTokenFor(identity)}`);
      expect(res.status).toBe(401);
    });

    it('should return 403 without users.read permission', async () => {
      const identity = await IdentityFactory.create(prisma);
      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tokenFor(identity)}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/users — auth', () => {
    it('should return 401 without token', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .send({
          email: 'unauth@example.com',
          password: 'Password123!',
          firstName: 'No',
          lastName: 'Auth',
        });
      expect(res.status).toBe(401);
    });

    it('should return 403 without users.create permission', async () => {
      const identity = await IdentityFactory.create(prisma);
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${tokenFor(identity)}`)
        .send({
          email: 'noperm@example.com',
          password: 'Password123!',
          firstName: 'No',
          lastName: 'Perm',
        });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/users/:id — auth', () => {
    it('should return 401 without token', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('should return 403 without users.read permission', async () => {
      const identity = await IdentityFactory.create(prisma);
      const res = await request(httpServer)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenFor(identity)}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/users/:id — auth', () => {
    it('should return 401 without token', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .send({ firstName: 'Hacked' });
      expect(res.status).toBe(401);
    });

    it('should return 403 without users.update permission', async () => {
      const identity = await IdentityFactory.create(prisma);
      const res = await request(httpServer)
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenFor(identity)}`)
        .send({ firstName: 'Hacked' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/users/:id — auth', () => {
    it('should return 401 without token', async () => {
      const res = await request(httpServer)
        .delete('/api/v1/users/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('should return 403 without users.delete permission', async () => {
      const identity = await IdentityFactory.create(prisma);
      const res = await request(httpServer)
        .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenFor(identity)}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/users/register — security', () => {
    it('should store password as hash, not plain text', async () => {
      await request(httpServer)
        .post('/api/v1/users/register')
        .send({
          email: 'hash-check@example.com',
          password: 'Password123!',
          firstName: 'Hash',
          lastName: 'Check',
        });

      const identity = await prisma.identity.findUnique({
        where: { email: 'hash-check@example.com' },
      });
      expect(identity).not.toBeNull();
      expect(identity!.passwordHash).not.toBe('Password123!');
      expect(identity!.passwordHash).toMatch(/^\$2[aby]?\$/);
    });

    it('should never return password or passwordHash in response', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/register')
        .send({
          email: 'no-leak@example.com',
          password: 'Password123!',
          firstName: 'No',
          lastName: 'Leak',
        });

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should not expose soft-deleted users via GET', async () => {
      // Grant read permission
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

      const user = await UserFactory.create(prisma);
      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt: new Date() },
      });

      const res = await request(httpServer)
        .get(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(404);
    });
  });
});
