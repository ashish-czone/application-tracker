import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { createTestIdentity, type TestIdentity } from '../../../../../../../test/utils/identity';
import { USERS_PERMISSIONS } from '../../permissions';

describe('UsersController (security)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: DrizzleDB;
  let httpServer: any;
  let authorizedIdentity: TestIdentity;
  let noPermissionIdentity: TestIdentity;
  let readOnlyIdentity: TestIdentity;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    module = testApp.module;
    db = testApp.db;
    httpServer = testApp.httpServer;

    // Identity with all user permissions
    authorizedIdentity = await createTestIdentity(module, db, {
      userType: 'admin',
      permissions: [
        USERS_PERMISSIONS.CREATE,
        USERS_PERMISSIONS.READ,
        USERS_PERMISSIONS.UPDATE,
        USERS_PERMISSIONS.DELETE,
      ],
    });

    // Identity with no permissions
    noPermissionIdentity = await createTestIdentity(module, db, {
      userType: 'client',
      permissions: [],
    });

    // Identity with only read permission
    readOnlyIdentity = await createTestIdentity(module, db, {
      userType: 'admin',
      permissions: [USERS_PERMISSIONS.READ],
    });
  });

  afterAll(async () => {
    await cleanDatabase(db);
    await app.close();
  });

  // --- 401 Unauthenticated ---

  describe('unauthenticated (401)', () => {
    it('GET /api/v1/users should return 401', async () => {
      const res = await request(httpServer).get('/api/v1/users');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/users/:id should return 401', async () => {
      const res = await request(httpServer).get('/api/v1/users/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/users should return 401', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .send({
          email: 'unauth@example.com',
          firstName: 'No',
          lastName: 'Auth',
          password: 'Password123!',
          userTypes: ['client'],
        });
      expect(res.status).toBe(401);
    });

    it('PATCH /api/v1/users/:id should return 401', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .send({ firstName: 'Nope' });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/v1/users/:id should return 401', async () => {
      const res = await request(httpServer).delete('/api/v1/users/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('should return 401 for expired/invalid token', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  // --- 403 Forbidden (wrong permissions) ---

  describe('forbidden — no permissions (403)', () => {
    it('GET /api/v1/users should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/users/:id should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/users should return 403', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({
          email: 'forbidden@example.com',
          firstName: 'No',
          lastName: 'Perm',
          password: 'Password123!',
          userTypes: ['client'],
        });
      expect(res.status).toBe(403);
    });

    it('PATCH /api/v1/users/:id should return 403', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({ firstName: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/v1/users/:id should return 403', async () => {
      const res = await request(httpServer)
        .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });
  });

  // --- 403 Forbidden (read-only — cannot create/update/delete) ---

  describe('forbidden — read-only permission (403)', () => {
    it('POST /api/v1/users should return 403 with only read permission', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${readOnlyIdentity.accessToken}`)
        .send({
          email: 'readonly-create@example.com',
          firstName: 'Read',
          lastName: 'Only',
          password: 'Password123!',
          userTypes: ['client'],
        });
      expect(res.status).toBe(403);
    });

    it('PATCH /api/v1/users/:id should return 403 with only read permission', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${readOnlyIdentity.accessToken}`)
        .send({ firstName: 'Nope' });
      expect(res.status).toBe(403);
    });

    it('DELETE /api/v1/users/:id should return 403 with only read permission', async () => {
      const res = await request(httpServer)
        .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${readOnlyIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/users should succeed with read permission', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${readOnlyIdentity.accessToken}`);
      expect(res.status).toBe(200);
    });
  });

  // --- Soft-deleted records not leaked ---

  describe('soft-deleted records not leaked', () => {
    it('should not return soft-deleted users in list', async () => {
      // Create and delete a user
      const createRes = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authorizedIdentity.accessToken}`)
        .send({
          email: 'soft-deleted-leak@example.com',
          firstName: 'Soft',
          lastName: 'Deleted',
          password: 'Password123!',
          userTypes: ['client'],
        });

      await request(httpServer)
        .delete(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authorizedIdentity.accessToken}`);

      const listRes = await request(httpServer)
        .get('/api/v1/users?search=soft-deleted-leak')
        .set('Authorization', `Bearer ${authorizedIdentity.accessToken}`);

      expect(listRes.status).toBe(200);
      const emails = listRes.body.data.map((u: any) => u.email);
      expect(emails).not.toContain('soft-deleted-leak@example.com');
    });

    it('should return 404 for soft-deleted user by ID', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authorizedIdentity.accessToken}`)
        .send({
          email: 'soft-deleted-get@example.com',
          firstName: 'Soft',
          lastName: 'Get',
          password: 'Password123!',
          userTypes: ['client'],
        });

      await request(httpServer)
        .delete(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authorizedIdentity.accessToken}`);

      const getRes = await request(httpServer)
        .get(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${authorizedIdentity.accessToken}`);

      expect(getRes.status).toBe(404);
    });
  });
});
