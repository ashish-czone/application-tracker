import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { tokenFor, expiredTokenFor } from '../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../test/factories/identityFactory';

describe('Settings API — security', () => {
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

  describe('401 — unauthenticated', () => {
    it('GET /api/v1/settings — should reject without token', async () => {
      const res = await request(httpServer).get('/api/v1/settings');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/settings/:module — should reject without token', async () => {
      const res = await request(httpServer).get('/api/v1/settings/identity');
      expect(res.status).toBe(401);
    });

    it('PATCH /api/v1/settings/:module — should reject without token', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/settings/identity')
        .send({ settings: [{ key: 'timeout', value: 30 }] });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/v1/settings/:module/:key — should reject without token', async () => {
      const res = await request(httpServer).delete('/api/v1/settings/identity/timeout');
      expect(res.status).toBe(401);
    });

    it('should reject expired token', async () => {
      const identity = await IdentityFactory.create(prisma);

      const res = await request(httpServer)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${expiredTokenFor(identity)}`);

      expect(res.status).toBe(401);
    });
  });

  describe('403 — missing permission', () => {
    it('GET /api/v1/settings — should reject without settings.read permission', async () => {
      const identity = await IdentityFactory.create(prisma);

      const res = await request(httpServer)
        .get('/api/v1/settings')
        .set('Authorization', `Bearer ${tokenFor(identity)}`);

      expect(res.status).toBe(403);
    });

    it('PATCH /api/v1/settings/:module — should reject without settings.manage permission', async () => {
      const identity = await IdentityFactory.create(prisma);

      const res = await request(httpServer)
        .patch('/api/v1/settings/identity')
        .set('Authorization', `Bearer ${tokenFor(identity)}`)
        .send({ settings: [{ key: 'timeout', value: 30 }] });

      expect(res.status).toBe(403);
    });

    it('DELETE /api/v1/settings/:module/:key — should reject without settings.manage permission', async () => {
      const identity = await IdentityFactory.create(prisma);

      const res = await request(httpServer)
        .delete('/api/v1/settings/identity/timeout')
        .set('Authorization', `Bearer ${tokenFor(identity)}`);

      expect(res.status).toBe(403);
    });
  });
});
