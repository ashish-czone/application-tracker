import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@packages/database';
import { createTestApp } from '../../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../../test/utils/db';
import { tokenFor } from '../../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../../test/factories/identityFactory';

function extractRefreshCookie(res: request.Response): string {
  const cookies = res.headers['set-cookie'];
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  const refreshCookie = arr.find((c: string) => c.startsWith('refresh_token='));
  if (!refreshCookie) throw new Error('No refresh_token cookie found');
  return refreshCookie.split(';')[0];
}

describe('Auth Integration Tests', () => {
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

  describe('POST /api/v1/users/auth/register', () => {
    it('should create identity, return accessToken, and set refresh cookie', async () => {
      const body = IdentityFactory.build();

      const res = await request(httpServer)
        .post('/api/v1/users/auth/register')
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const arr = Array.isArray(cookies) ? cookies : [cookies];
      const refreshCookie = arr.find((c: string) => c.startsWith('refresh_token='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('should return 409 for duplicate email', async () => {
      const body = IdentityFactory.build();

      await request(httpServer)
        .post('/api/v1/users/auth/register')
        .send(body);

      const res = await request(httpServer)
        .post('/api/v1/users/auth/register')
        .send(body);

      expect(res.status).toBe(409);
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/auth/register')
        .send({ email: 'not-an-email', password: 'Password123!' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for short password', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/auth/register')
        .send({ email: 'test@example.com', password: 'short' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for unknown properties', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/auth/register')
        .send({
          email: 'new@example.com',
          password: 'Password123!',
          hackerField: 'injected',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/users/auth/login', () => {
    it('should return tokens for valid credentials', async () => {
      const identity = await IdentityFactory.create(prisma);

      const res = await request(httpServer)
        .post('/api/v1/users/auth/login')
        .send({ email: identity.email, password: IdentityFactory.DEFAULT_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should return 401 for wrong password', async () => {
      const identity = await IdentityFactory.create(prisma);

      const res = await request(httpServer)
        .post('/api/v1/users/auth/login')
        .send({ email: identity.email, password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should return 401 for nonexistent email with same error message', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });
  });

  describe('POST /api/v1/users/auth/refresh', () => {
    it('should issue new tokens from valid refresh cookie', async () => {
      const identity = await IdentityFactory.create(prisma);

      // Login to get a refresh cookie
      const loginRes = await request(httpServer)
        .post('/api/v1/users/auth/login')
        .send({ email: identity.email, password: IdentityFactory.DEFAULT_PASSWORD });

      const cookie = extractRefreshCookie(loginRes);

      const res = await request(httpServer)
        .post('/api/v1/users/auth/refresh')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should return 401 for expired refresh token', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/auth/refresh')
        .set('Cookie', 'refresh_token=expired-token');

      expect(res.status).toBe(401);
    });

    it('should invalidate old refresh token after rotation', async () => {
      const identity = await IdentityFactory.create(prisma);

      const loginRes = await request(httpServer)
        .post('/api/v1/users/auth/login')
        .send({ email: identity.email, password: IdentityFactory.DEFAULT_PASSWORD });

      const oldCookie = extractRefreshCookie(loginRes);

      const hashBefore = (await prisma.identity.findUnique({ where: { id: identity.id } }))!.refreshToken;

      // First refresh — should succeed and rotate the token
      const firstRefresh = await request(httpServer)
        .post('/api/v1/users/auth/refresh')
        .set('Cookie', oldCookie);

      expect(firstRefresh.status).toBe(200);

      const hashAfter = (await prisma.identity.findUnique({ where: { id: identity.id } }))!.refreshToken;
      expect(hashAfter).not.toBe(hashBefore);

      // Second refresh with OLD cookie — should fail (rotation detected)
      const res = await request(httpServer)
        .post('/api/v1/users/auth/refresh')
        .set('Cookie', oldCookie);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/users/auth/logout', () => {
    it('should clear refresh token', async () => {
      const identity = await IdentityFactory.create(prisma);
      const token = tokenFor(identity);

      const res = await request(httpServer)
        .post('/api/v1/users/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const dbIdentity = await prisma.identity.findUnique({ where: { id: identity.id } });
      expect(dbIdentity!.refreshToken).toBeNull();
    });
  });

  describe('POST /api/v1/users/auth/forgot-password', () => {
    it('should return 200 even for nonexistent email', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
    });

    it('should create PasswordToken record in DB', async () => {
      const identity = await IdentityFactory.create(prisma);

      await request(httpServer)
        .post('/api/v1/users/auth/forgot-password')
        .send({ email: identity.email });

      const tokens = await prisma.passwordToken.findMany({
        where: { identityId: identity.id },
      });
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/users/auth/reset-password', () => {
    it('should update password with valid token', async () => {
      const identity = await IdentityFactory.create(prisma);
      const oldHash = (await prisma.identity.findUnique({ where: { id: identity.id } }))!.passwordHash;

      const token = await prisma.passwordToken.create({
        data: {
          identityId: identity.id,
          token: 'valid-reset-token-' + Date.now(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const res = await request(httpServer)
        .post('/api/v1/users/auth/reset-password')
        .send({ token: token.token, newPassword: 'NewPassword123!' });

      expect(res.status).toBe(200);

      // Verify password hash changed in DB
      const updated = await prisma.identity.findUnique({ where: { id: identity.id } });
      expect(updated!.passwordHash).not.toBe(oldHash);

      // Verify token is marked as used
      const usedToken = await prisma.passwordToken.findUnique({ where: { id: token.id } });
      expect(usedToken!.usedAt).not.toBeNull();
    });

    it('should return 400 for expired token', async () => {
      const identity = await IdentityFactory.create(prisma);

      const token = await prisma.passwordToken.create({
        data: {
          identityId: identity.id,
          token: 'expired-token-' + Date.now(),
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      const res = await request(httpServer)
        .post('/api/v1/users/auth/reset-password')
        .send({ token: token.token, newPassword: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for already-used token', async () => {
      const identity = await IdentityFactory.create(prisma);

      const token = await prisma.passwordToken.create({
        data: {
          identityId: identity.id,
          token: 'used-token-' + Date.now(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          usedAt: new Date(),
        },
      });

      const res = await request(httpServer)
        .post('/api/v1/users/auth/reset-password')
        .send({ token: token.token, newPassword: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });
  });
});
