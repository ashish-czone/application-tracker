import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDB } from '@packages/database';
import { createTestApp } from '../../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../../test/utils/db';
import { expiredTokenFor } from '../../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../../test/factories/identityFactory';

describe('Permissions API — security', () => {
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

  it('should return 401 without auth token', async () => {
    const res = await request(httpServer)
      .get('/api/v1/permissions')
      .send();

    expect(res.status).toBe(401);
  });

  it('should return 401 with expired token', async () => {
    const identity = await IdentityFactory.create(db);

    const res = await request(httpServer)
      .get('/api/v1/permissions')
      .set('Authorization', `Bearer ${expiredTokenFor(identity)}`);

    expect(res.status).toBe(401);
  });
});
