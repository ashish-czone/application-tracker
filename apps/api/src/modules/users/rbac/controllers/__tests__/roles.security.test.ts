import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createTestApp } from '../../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../../test/utils/db';
import { tokenFor, expiredTokenFor } from '../../../../../../../../test/utils/auth';
import { UserFactory } from '../../../../../../../../test/factories/userFactory';

describe('Roles API — security', () => {
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

  it('should return 401 without auth token', async () => {
    const res = await request(httpServer)
      .get('/api/v1/roles')
      .send();

    expect(res.status).toBe(401);
  });

  it('should return 401 with expired token', async () => {
    const user = await UserFactory.create(prisma);

    const res = await request(httpServer)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${expiredTokenFor(user)}`);

    expect(res.status).toBe(401);
  });

  it('should return 403 without rbac.roles.manage permission', async () => {
    const user = await UserFactory.create(prisma);

    const res = await request(httpServer)
      .get('/api/v1/roles')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(403);
  });

  it('should include permissions array in GET /auth/me response', async () => {
    const user = await UserFactory.create(prisma);

    const res = await request(httpServer)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('permissions');
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });
});
