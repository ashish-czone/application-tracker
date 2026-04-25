import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { createTestApp } from '@test/utils/app';
import { createTestIdentity, type TestIdentity } from '@test/utils/identity';
import { cleanDatabase } from '@test/utils/db';
import { RbacService } from '@packages/rbac';
import { AuthService } from '@packages/auth';

/**
 * End-to-end tests for the users routes owned by UsersController +
 * UsersService. Exercises:
 *
 * - Nested DTO write path (`credentials.password`, `roles: [ids]`) — the
 *   service composes credentials + role assignments with the users row
 *   insert in a single tx.
 * - List / detail role enrichment via the read-side service.
 * - POST /:id/reset-password admin endpoint.
 * - RBAC gating on every route (401 unauthenticated, 403 insufficient perms).
 */
describe('Users Security', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: DrizzleDB;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  let adminUser: TestIdentity;
  let readOnlyUser: TestIdentity;
  let noPermUser: TestIdentity;

  let adminRoleId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    module = ctx.module;
    db = ctx.db;
    httpServer = ctx.httpServer;
  });

  afterAll(async () => {
    await app.close();
  });

  async function verifyPassword(identifier: string, password: string): Promise<boolean> {
    const authService = module.get(AuthService);
    try {
      await authService.verifyPasswordCredential(identifier, password);
      return true;
    } catch {
      return false;
    }
  }

  beforeEach(async () => {
    await cleanDatabase(db);

    [adminUser, readOnlyUser, noPermUser] = await Promise.all([
      createTestIdentity(module, db, {
        userType: 'admin',
        permissions: ['users.create', 'users.read', 'users.update', 'users.delete'],
      }),
      createTestIdentity(module, db, {
        userType: 'admin',
        permissions: ['users.read'],
      }),
      createTestIdentity(module, db, {
        userType: 'admin',
        permissions: [],
      }),
    ]);

    // A role we can assign to created users
    const rbac = module.get(RbacService);
    const role = await rbac.createRole({ name: 'e2e-admin-role', userType: 'admin' });
    adminRoleId = role.id;
  });

  // ── 401 Unauthenticated ─────────────────────────────────────

  describe('401 — Unauthenticated', () => {
    it('GET /users without token → 401', async () => {
      await request(httpServer).get('/api/v1/users').expect(401);
    });

    it('POST /users without token → 401', async () => {
      await request(httpServer)
        .post('/api/v1/users')
        .send({ email: 'a@b.com', firstName: 'A', lastName: 'B', userType: 'admin' })
        .expect(401);
    });

    it('POST /users/:id/reset-password without token → 401', async () => {
      await request(httpServer)
        .post('/api/v1/users/00000000-0000-0000-0000-000000000000/reset-password')
        .send({ password: 'x' })
        .expect(401);
    });
  });

  // ── 403 Insufficient permissions ────────────────────────────

  describe('403 — Insufficient permissions', () => {
    it('POST /users with only users.read → 403', async () => {
      await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${readOnlyUser.accessToken}`)
        .send({
          email: 'forbidden@example.com',
          firstName: 'F',
          lastName: 'U',
          userType: 'admin',
          credentials: { password: 'Pw0rd!23' },
        })
        .expect(403);
    });

    it('GET /users with no permissions → 403', async () => {
      await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${noPermUser.accessToken}`)
        .expect(403);
    });

    it('POST /users/:id/reset-password with only users.read → 403', async () => {
      await request(httpServer)
        .post('/api/v1/users/00000000-0000-0000-0000-000000000000/reset-password')
        .set('Authorization', `Bearer ${readOnlyUser.accessToken}`)
        .send({ password: 'x' })
        .expect(403);
    });
  });

  // ── POST /users — nested DTO create ─────────────────────────

  describe('POST /users (nested DTO)', () => {
    it('creates a user with password (hasOne handler) and roles (manyToMany handler) atomically', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          email: 'dynamic@example.com',
          firstName: 'Dyn',
          lastName: 'Amic',
          phone: '+15550001234',
          userType: 'admin',
          credentials: { password: 'Secret123!' },
          roles: [adminRoleId],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.email).toBe('dynamic@example.com');

      // Password actually stored: the new user can authenticate
      expect(await verifyPassword('dynamic@example.com', 'Secret123!')).toBe(true);

      // Role assigned via handler
      const rbac = module.get(RbacService);
      const roles = await rbac.getUserRoles(res.body.id);
      expect(roles.map((r) => r.id)).toEqual([adminRoleId]);
    });

    it('rolls back the user insert if the credentials handler throws (missing password)', async () => {
      // credentials.password is required on create — omitting it inside the
      // credentials object should roll back the parent insert.
      await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          email: 'nopass@example.com',
          firstName: 'No',
          lastName: 'Pass',
          userType: 'admin',
          credentials: {},
        })
        .expect((r) => {
          expect([400, 422]).toContain(r.status);
        });

      // No row written
      const list = await request(httpServer)
        .get('/api/v1/users?search=nopass')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .expect(200);
      expect(list.body.data.find((u: { email: string }) => u.email === 'nopass@example.com')).toBeUndefined();
    });

    it('rejects duplicate email (unique constraint, case-insensitive)', async () => {
      const base = {
        firstName: 'Dup',
        lastName: 'User',
        userType: 'admin',
        credentials: { password: 'Secret123!' },
      };
      await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({ ...base, email: 'dup@example.com' })
        .expect(201);

      await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({ ...base, email: 'DUP@example.com' })
        .expect(409);
    });
  });

  // ── PATCH /users/:id ────────────────────────────────────────

  describe('PATCH /users/:id (nested credentials optional)', () => {
    async function createTestUser() {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          email: `upd-${Date.now()}@example.com`,
          firstName: 'Upd',
          lastName: 'Me',
          userType: 'admin',
          credentials: { password: 'OldSecret1!' },
        })
        .expect(201);
      return res.body;
    }

    it('updates plain fields without touching credentials when the key is absent', async () => {
      const user = await createTestUser();

      await request(httpServer)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({ firstName: 'Renamed' })
        .expect(200);

      expect(await verifyPassword(user.email, 'OldSecret1!')).toBe(true);
    });

    it('updates the password when credentials.password is present', async () => {
      const user = await createTestUser();

      await request(httpServer)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({ credentials: { password: 'NewSecret1!' } })
        .expect(200);

      expect(await verifyPassword(user.email, 'OldSecret1!')).toBe(false);
      expect(await verifyPassword(user.email, 'NewSecret1!')).toBe(true);
    });
  });

  // ── Read-side role enrichment via hooks ─────────────────────

  describe('GET /users (afterList) and GET /users/:id (afterFindOne)', () => {
    it('list rows include the roles array (empty when no assignments)', async () => {
      await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          email: 'no-roles@example.com',
          firstName: 'NR',
          lastName: 'X',
          userType: 'admin',
          credentials: { password: 'Secret123!' },
        })
        .expect(201);

      const res = await request(httpServer)
        .get('/api/v1/users?search=no-roles')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .expect(200);

      const hit = res.body.data.find((u: { email: string }) => u.email === 'no-roles@example.com');
      expect(hit).toBeDefined();
      expect(hit.roles).toEqual([]);
    });

    it('list rows include role objects when roles are assigned', async () => {
      const created = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          email: 'with-roles@example.com',
          firstName: 'WR',
          lastName: 'X',
          userType: 'admin',
          credentials: { password: 'Secret123!' },
          roles: [adminRoleId],
        })
        .expect(201);

      const res = await request(httpServer)
        .get('/api/v1/users?search=with-roles')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .expect(200);

      const hit = res.body.data.find((u: { id: string }) => u.id === created.body.id);
      expect(hit.roles).toHaveLength(1);
      expect(hit.roles[0].id).toBe(adminRoleId);
    });

    it('detail response includes the roles array', async () => {
      const created = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          email: 'detail@example.com',
          firstName: 'D',
          lastName: 'T',
          userType: 'admin',
          credentials: { password: 'Secret123!' },
          roles: [adminRoleId],
        })
        .expect(201);

      const res = await request(httpServer)
        .get(`/api/v1/users/${created.body.id}`)
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .expect(200);

      expect(res.body.roles).toHaveLength(1);
      expect(res.body.roles[0].id).toBe(adminRoleId);
    });
  });

  // ── DELETE /users/:id (soft) ────────────────────────────────

  describe('DELETE /users/:id', () => {
    it('soft-deletes the user (no longer returned by list)', async () => {
      const created = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          email: 'to-delete@example.com',
          firstName: 'Del',
          lastName: 'Me',
          userType: 'admin',
          credentials: { password: 'Secret123!' },
        })
        .expect(201);

      await request(httpServer)
        .delete(`/api/v1/users/${created.body.id}`)
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .expect(204);

      const list = await request(httpServer)
        .get('/api/v1/users?search=to-delete')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .expect(200);
      expect(list.body.data.find((u: { id: string }) => u.id === created.body.id)).toBeUndefined();
    });
  });

  // ── POST /users/:id/reset-password (thin controller) ────────

  describe('POST /users/:id/reset-password', () => {
    it('resets the password for an existing user', async () => {
      const created = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({
          email: 'reset@example.com',
          firstName: 'R',
          lastName: 'S',
          userType: 'admin',
          credentials: { password: 'OldPass1!' },
        })
        .expect(201);

      await request(httpServer)
        .post(`/api/v1/users/${created.body.id}/reset-password`)
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({ password: 'BrandNew1!' })
        .expect(204);

      expect(await verifyPassword('reset@example.com', 'OldPass1!')).toBe(false);
      expect(await verifyPassword('reset@example.com', 'BrandNew1!')).toBe(true);
    });

    it('returns 404 for a non-existent user', async () => {
      await request(httpServer)
        .post('/api/v1/users/00000000-0000-0000-0000-000000000000/reset-password')
        .set('Authorization', `Bearer ${adminUser.accessToken}`)
        .send({ password: 'Whatever1!' })
        .expect(404);
    });
  });
});
