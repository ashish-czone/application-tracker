import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { createTestIdentity, type TestIdentity } from '../../../../../../../test/utils/identity';

describe('NotificationRulesController + TemplatesController (security)', () => {
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
    it('GET /notification-templates should return 401', async () => {
      expect((await request(httpServer).get('/api/v1/notification-templates')).status).toBe(401);
    });

    it('POST /notification-templates should return 401', async () => {
      expect((await request(httpServer).post('/api/v1/notification-templates').send({})).status).toBe(401);
    });

    it('GET /notification-rules should return 401', async () => {
      expect((await request(httpServer).get('/api/v1/notification-rules')).status).toBe(401);
    });

    it('POST /notification-rules should return 401', async () => {
      expect((await request(httpServer).post('/api/v1/notification-rules').send({})).status).toBe(401);
    });

    it('DELETE /notification-rules/:id should return 401', async () => {
      expect((await request(httpServer).delete('/api/v1/notification-rules/00000000-0000-0000-0000-000000000000')).status).toBe(401);
    });
  });

  // --- 403 Forbidden ---

  describe('forbidden — no permissions (403)', () => {
    it('GET /notification-templates should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('POST /notification-templates should return 403', async () => {
      const res = await request(httpServer)
        .post('/api/v1/notification-templates')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({ name: 'test', channel: 'email', body: 'test' });
      expect(res.status).toBe(403);
    });

    it('GET /notification-rules should return 403', async () => {
      const res = await request(httpServer)
        .get('/api/v1/notification-rules')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('POST /notification-rules should return 403', async () => {
      const res = await request(httpServer)
        .post('/api/v1/notification-rules')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({ name: 'test', eventName: 'test', recipientStrategy: 'actor', channels: [] });
      expect(res.status).toBe(403);
    });

    it('DELETE /notification-rules/:id should return 403', async () => {
      const res = await request(httpServer)
        .delete('/api/v1/notification-rules/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('PATCH /notification-templates/:id should return 403', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/notification-templates/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({ name: 'nope' });
      expect(res.status).toBe(403);
    });

    it('DELETE /notification-templates/:id should return 403', async () => {
      const res = await request(httpServer)
        .delete('/api/v1/notification-templates/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`);
      expect(res.status).toBe(403);
    });

    it('PATCH /notification-rules/:id should return 403', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/notification-rules/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({ name: 'nope' });
      expect(res.status).toBe(403);
    });

    it('PUT /notification-rules/:id/channels should return 403', async () => {
      const res = await request(httpServer)
        .put('/api/v1/notification-rules/00000000-0000-0000-0000-000000000000/channels')
        .set('Authorization', `Bearer ${noPermissionIdentity.accessToken}`)
        .send({ channels: [] });
      expect(res.status).toBe(403);
    });
  });
});
