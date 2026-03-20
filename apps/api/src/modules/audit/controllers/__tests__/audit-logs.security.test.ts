import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { createTestIdentity, type TestIdentity } from '../../../../../../../test/utils/identity';
import { AUDIT_PERMISSIONS } from '../../permissions';

describe('AuditLogsController (security)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: DrizzleDB;
  let httpServer: any;
  let authorizedIdentity: TestIdentity;
  let noPermissionIdentity: TestIdentity;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    module = testApp.module;
    db = testApp.db;
    httpServer = testApp.httpServer;

    authorizedIdentity = await createTestIdentity(module, db, {
      userType: 'admin',
      permissions: [AUDIT_PERMISSIONS.READ],
    });

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
    it('GET /api/v1/audit-logs should return 401', async () => {
      const res = await request(httpServer).get('/api/v1/audit-logs');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/audit-logs/:id should return 401', async () => {
      const res = await request(httpServer).get('/api/v1/audit-logs/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      const res = await request(httpServer)
        .get('/api/v1/audit-logs')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  // --- 403 Forbidden ---

  describe('forbidden — no permissions (403)', () => {
    it('GET /api/v1/audit-logs should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/audit-logs/:id should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/audit-logs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });
  });

  // --- 200 Authorized ---

  describe('authorized (200)', () => {
    it('GET /api/v1/audit-logs should succeed with audit.read permission', async () => {
      const res = await request(httpServer)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${authorizedIdentity.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });

    it('GET /api/v1/audit-logs/:id should return 404 for non-existent ID', async () => {
      const res = await request(httpServer)
        .get('/api/v1/audit-logs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authorizedIdentity.accessToken}`);
      expect(res.status).toBe(404);
    });
  });
});
