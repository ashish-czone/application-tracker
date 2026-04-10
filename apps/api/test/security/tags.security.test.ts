import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { createTestApp } from '@test/utils/app';
import { createTestIdentity, type TestIdentity } from '@test/utils/identity';
import { cleanDatabase } from '@test/utils/db';
import { TAXONOMY_PERMISSIONS } from '@packages/taxonomy';
import jsonwebtoken from 'jsonwebtoken';

describe('Tags Security', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: DrizzleDB;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  let readUser: TestIdentity;
  let manageUser: TestIdentity;
  let noPermUser: TestIdentity;

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

  beforeEach(async () => {
    await cleanDatabase(db);

    [readUser, manageUser, noPermUser] = await Promise.all([
      createTestIdentity(module, db, {
        userType: 'admin',
        permissions: [
          TAXONOMY_PERMISSIONS.TAG_GROUPS_READ,
          TAXONOMY_PERMISSIONS.TAGS_READ,
        ],
      }),
      createTestIdentity(module, db, {
        userType: 'admin',
        permissions: [
          TAXONOMY_PERMISSIONS.TAG_GROUPS_READ,
          TAXONOMY_PERMISSIONS.TAG_GROUPS_MANAGE,
          TAXONOMY_PERMISSIONS.TAGS_READ,
          TAXONOMY_PERMISSIONS.TAGS_MANAGE,
        ],
      }),
      createTestIdentity(module, db, {
        userType: 'admin',
        permissions: [],
      }),
    ]);
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createTagGroup(token: string) {
    seq++;
    const res = await request(httpServer)
      .post('/api/v1/tag-groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Group ${seq}`, slug: `group-${Date.now()}-${seq}` })
      .expect(201);
    return res.body;
  }

  // ── 401 Unauthenticated ─────────────────────────────────────

  describe('401 — Unauthenticated', () => {
    it('GET /tag-groups without token → 401', async () => {
      await request(httpServer)
        .get('/api/v1/tag-groups')
        .expect(401);
    });

    it('POST /tag-groups without token → 401', async () => {
      await request(httpServer)
        .post('/api/v1/tag-groups')
        .send({ name: 'Test', slug: 'test' })
        .expect(401);
    });

    it('GET /tags/:id without token → 401', async () => {
      await request(httpServer)
        .get('/api/v1/tags/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('expired token → 401', async () => {
      const expiredToken = jsonwebtoken.sign(
        {
          userId: readUser.userId,
          userType: 'admin',
          permissions: readUser.permissions,
        },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' },
      );

      await request(httpServer)
        .get('/api/v1/tag-groups')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('malformed token → 401', async () => {
      await request(httpServer)
        .get('/api/v1/tag-groups')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401);
    });
  });

  // ── 403 Forbidden ───────────────────────────────────────────

  describe('403 — Missing permissions', () => {
    it('user with no permissions cannot list tag groups', async () => {
      await request(httpServer)
        .get('/api/v1/tag-groups')
        .set('Authorization', `Bearer ${noPermUser.accessToken}`)
        .expect(403);
    });

    it('read-only user cannot create tag groups', async () => {
      await request(httpServer)
        .post('/api/v1/tag-groups')
        .set('Authorization', `Bearer ${readUser.accessToken}`)
        .send({ name: 'Test', slug: 'test' })
        .expect(403);
    });

    it('read-only user cannot update tag groups', async () => {
      const group = await createTagGroup(manageUser.accessToken);

      await request(httpServer)
        .patch(`/api/v1/tag-groups/${group.id}`)
        .set('Authorization', `Bearer ${readUser.accessToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('read-only user cannot delete tag groups', async () => {
      const group = await createTagGroup(manageUser.accessToken);

      await request(httpServer)
        .delete(`/api/v1/tag-groups/${group.id}`)
        .set('Authorization', `Bearer ${readUser.accessToken}`)
        .expect(403);
    });

    it('read-only user cannot create tags', async () => {
      const group = await createTagGroup(manageUser.accessToken);

      await request(httpServer)
        .post(`/api/v1/tag-groups/${group.id}/tags`)
        .set('Authorization', `Bearer ${readUser.accessToken}`)
        .send({ name: 'Tag', slug: 'tag' })
        .expect(403);
    });

    it('read-only user cannot update tags', async () => {
      const group = await createTagGroup(manageUser.accessToken);

      const tagRes = await request(httpServer)
        .post(`/api/v1/tag-groups/${group.id}/tags`)
        .set('Authorization', `Bearer ${manageUser.accessToken}`)
        .send({ name: 'Tag', slug: `tag-${Date.now()}` })
        .expect(201);

      await request(httpServer)
        .patch(`/api/v1/tags/${tagRes.body.id}`)
        .set('Authorization', `Bearer ${readUser.accessToken}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('read-only user cannot delete tags', async () => {
      const group = await createTagGroup(manageUser.accessToken);

      const tagRes = await request(httpServer)
        .post(`/api/v1/tag-groups/${group.id}/tags`)
        .set('Authorization', `Bearer ${manageUser.accessToken}`)
        .send({ name: 'Tag', slug: `tag-${Date.now()}` })
        .expect(201);

      await request(httpServer)
        .delete(`/api/v1/tags/${tagRes.body.id}`)
        .set('Authorization', `Bearer ${readUser.accessToken}`)
        .expect(403);
    });
  });

  // ── Authorized access ───────────────────────────────────────

  describe('Authorized — read user can read', () => {
    it('read-only user can list tag groups', async () => {
      await createTagGroup(manageUser.accessToken);

      const res = await request(httpServer)
        .get('/api/v1/tag-groups')
        .set('Authorization', `Bearer ${readUser.accessToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('read-only user can get a tag group by ID', async () => {
      const group = await createTagGroup(manageUser.accessToken);

      await request(httpServer)
        .get(`/api/v1/tag-groups/${group.id}`)
        .set('Authorization', `Bearer ${readUser.accessToken}`)
        .expect(200);
    });

    it('read-only user can list tags', async () => {
      const group = await createTagGroup(manageUser.accessToken);

      await request(httpServer)
        .get(`/api/v1/tag-groups/${group.id}/tags`)
        .set('Authorization', `Bearer ${readUser.accessToken}`)
        .expect(200);
    });
  });

  // ── Mass assignment ─────────────────────────────────────────

  describe('Mass assignment protection', () => {
    it('unknown properties are rejected on create', async () => {
      await request(httpServer)
        .post('/api/v1/tag-groups')
        .set('Authorization', `Bearer ${manageUser.accessToken}`)
        .send({ name: 'Test', slug: 'test', isAdmin: true })
        .expect(400);
    });

    it('unknown properties are rejected on update', async () => {
      const group = await createTagGroup(manageUser.accessToken);

      await request(httpServer)
        .patch(`/api/v1/tag-groups/${group.id}`)
        .set('Authorization', `Bearer ${manageUser.accessToken}`)
        .send({ name: 'Updated', id: '00000000-0000-0000-0000-000000000000' })
        .expect(400);
    });
  });
});
