import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { createTestIdentity, type TestIdentity } from '../../../../../../../test/utils/identity';

describe('RbacController (security)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: DrizzleDB;
  let httpServer: any;
  let noPermissionIdentity: TestIdentity;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    module = testApp.module;
    db = testApp.db;
    httpServer = testApp.httpServer;

    noPermissionIdentity = await createTestIdentity(module, db, {
      userType: 'client',
      permissions: [],
    });
  });

  afterAll(async () => {
    await cleanDatabase(db);
    await app.close();
  });

  // --- 401 Unauthenticated ---

  describe('unauthenticated (401)', () => {
    it('GET /api/v1/roles should return 401', async () => {
      const res = await request(httpServer).get('/api/v1/roles');
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/roles should return 401', async () => {
      const res = await request(httpServer)
        .post('/api/v1/roles')
        .send({ name: 'test', userType: 'admin' });
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/roles/:id should return 401', async () => {
      const res = await request(httpServer).get('/api/v1/roles/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('PATCH /api/v1/roles/:id should return 401', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .send({ name: 'nope' });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/v1/roles/:id should return 401', async () => {
      const res = await request(httpServer).delete('/api/v1/roles/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/roles/:id/permissions should return 401', async () => {
      const res = await request(httpServer).get('/api/v1/roles/00000000-0000-0000-0000-000000000000/permissions');
      expect(res.status).toBe(401);
    });

    it('PUT /api/v1/roles/:id/permissions should return 401', async () => {
      const res = await request(httpServer)
        .put('/api/v1/roles/00000000-0000-0000-0000-000000000000/permissions')
        .send({ permissions: [] });
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/permissions/registry should return 401', async () => {
      const res = await request(httpServer).get('/api/v1/permissions/registry');
      expect(res.status).toBe(401);
    });
  });

  // --- 403 Forbidden ---

  describe('forbidden — no permissions (403)', () => {
    it('GET /api/v1/roles should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/roles should return 403', async () => {
      const res = await request(httpServer)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({ name: 'test', userType: 'admin' });
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/roles/:id should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('PATCH /api/v1/roles/:id should return 403', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({ name: 'nope' });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/v1/roles/:id should return 403', async () => {
      const res = await request(httpServer)
        .delete('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/roles/:id/permissions should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/roles/00000000-0000-0000-0000-000000000000/permissions')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('PUT /api/v1/roles/:id/permissions should return 403', async () => {
      const res = await request(httpServer)
        .put('/api/v1/roles/00000000-0000-0000-0000-000000000000/permissions')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({ permissions: [] });
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/permissions/registry should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/permissions/registry')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });
  });
});
