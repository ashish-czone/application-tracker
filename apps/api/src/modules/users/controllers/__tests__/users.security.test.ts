import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDB } from '@packages/database';
import { identities, users, permissions, roles, rolePermissions, eq, and } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { tokenFor, expiredTokenFor } from '../../../../../../../test/utils/auth';
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

describe('Users API — security', () => {
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

  describe('GET /api/v1/users — auth', () => {
    it('should return 401 without token', async () => {
      const res = await request(httpServer).get('/api/v1/users');
      expect(res.status).toBe(401);
    });

    it('should return 401 with expired token', async () => {
      const identity = await IdentityFactory.create(db);
      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${expiredTokenFor(identity)}`);
      expect(res.status).toBe(401);
    });

    it('should return 403 without users.read permission', async () => {
      const identity = await IdentityFactory.create(db);
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
      const identity = await IdentityFactory.create(db);
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
      const identity = await IdentityFactory.create(db);
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
      const identity = await IdentityFactory.create(db);
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
      const identity = await IdentityFactory.create(db);
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

      const [identity] = await db.select().from(identities)
        .where(eq(identities.email, 'hash-check@example.com')).limit(1);
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
      const admin = await IdentityFactory.createWithRole(db, 'superadmin');
      const perm = await upsertPermission(db, 'users', 'read');
      const [role] = await db.select().from(roles).where(eq(roles.name, 'superadmin')).limit(1);
      await upsertRolePermission(db, role!.id, perm.id);

      const user = await UserFactory.create(db);
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));

      const res = await request(httpServer)
        .get(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(404);
    });
  });
});
