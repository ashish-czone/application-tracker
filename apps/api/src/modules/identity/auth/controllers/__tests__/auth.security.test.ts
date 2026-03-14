import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createTestApp } from '../../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../../test/utils/db';
import { tokenFor, expiredTokenFor } from '../../../../../../../../test/utils/auth';
import { UserFactory } from '../../../../../../../../test/factories/userFactory';

describe('Auth Security Tests', () => {
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

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(httpServer).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 with expired token', async () => {
      const user = await UserFactory.create(prisma);
      const res = await request(httpServer)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredTokenFor(user)}`);
      expect(res.status).toBe(401);
    });

    it('should return 401 with wrong JWT secret', async () => {
      const token = jwt.sign(
        { sub: 'user-123', email: 'test@example.com', entityName: 'user' },
        'wrong-secret',
        { expiresIn: '15m' },
      );
      const res = await request(httpServer)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });

    it('should never contain passwordHash in response', async () => {
      const user = await UserFactory.create(prisma);
      const res = await request(httpServer)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should never contain refreshToken in response', async () => {
      const user = await UserFactory.create(prisma);
      const res = await request(httpServer)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`);

      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('refreshToken');
    });
  });

  describe('POST /api/v1/auth/register — security', () => {
    it('should store password as bcrypt hash in DB', async () => {
      const body = UserFactory.build();

      await request(httpServer)
        .post('/api/v1/auth/register')
        .send(body);

      const dbUser = await prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.passwordHash).not.toBe(body.password);
      expect(dbUser!.passwordHash).toMatch(/^\$2[aby]?\$/);
    });

    it('should reject unknown fields', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/register')
        .send({
          email: 'security-test@example.com',
          password: 'Password123!',
          isAdmin: true,
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login — security', () => {
    it('should return consistent error message for wrong password vs nonexistent email', async () => {
      const user = await UserFactory.create(prisma);

      const wrongPwRes = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'WrongPassword123!' });

      const noUserRes = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123!' });

      expect(wrongPwRes.body.message).toBe(noUserRes.body.message);
    });

    it('should reject unknown fields', async () => {
      const res = await request(httpServer)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
          extraField: 'injected',
        });

      expect(res.status).toBe(400);
    });

    it('should return 429 after rate limit exceeded', async () => {
      const results = [];
      for (let i = 0; i < 7; i++) {
        const res = await request(httpServer)
          .post('/api/v1/auth/login')
          .send({ email: `ratelimit${i}@example.com`, password: 'Password123!' });
        results.push(res.status);
      }

      expect(results).toContain(429);
    });
  });
});
