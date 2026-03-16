import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { createTestIdentity, type TestIdentity } from '../../../../../../../test/utils/identity';
import { USERS_PERMISSIONS } from '../../permissions';

describe('UsersController (integration)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: DrizzleDB;
  let httpServer: any;
  let adminIdentity: TestIdentity;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    module = testApp.module;
    db = testApp.db;
    httpServer = testApp.httpServer;

    adminIdentity = await createTestIdentity(module, db, {
      userType: 'admin',
      permissions: [
        USERS_PERMISSIONS.CREATE,
        USERS_PERMISSIONS.READ,
        USERS_PERMISSIONS.UPDATE,
        USERS_PERMISSIONS.DELETE,
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase(db);
    await app.close();
  });

  // --- POST /api/v1/users ---

  describe('POST /api/v1/users', () => {
    it('should create a user and return 201', async () => {
      const body = {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        password: 'Password123!',
        userType: 'client',
      };

      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send(body);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        userType: 'client',
      });
    });

    it('should return 409 if email already exists', async () => {
      const body = {
        email: 'duplicate@example.com',
        firstName: 'First',
        lastName: 'User',
        password: 'Password123!',
        userType: 'client',
      };

      await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send(body);

      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send(body);

      expect(res.status).toBe(409);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid email', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'not-an-email',
          firstName: 'Test',
          lastName: 'User',
          password: 'Password123!',
          userType: 'client',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for password too short', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'valid@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'short',
          userType: 'client',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid userType', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'valid2@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'Password123!',
          userType: 'invalid',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for missing userType', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'valid3@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
    });

    it('should reject unknown fields', async () => {
      const res = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'valid4@example.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'Password123!',
          userType: 'client',
          isAdmin: true,
        });

      expect(res.status).toBe(400);
    });
  });

  // --- GET /api/v1/users ---

  describe('GET /api/v1/users', () => {
    it('should return paginated list of users', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        total: expect.any(Number),
        page: 1,
        limit: 25,
        totalPages: expect.any(Number),
      });
    });

    it('should filter by userType', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users?userType=client')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      for (const user of res.body.data) {
        expect(user.userType).toBe('client');
      }
    });

    it('should search by name', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users?search=New')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((u: any) => u.firstName === 'New')).toBe(true);
    });

    it('should respect pagination parameters', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.limit).toBe(2);
    });

    it('should return 400 for invalid page parameter', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users?page=0')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(400);
    });

    it('should return 400 for limit exceeding max', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users?limit=101')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(400);
    });
  });

  // --- GET /api/v1/users/:id ---

  describe('GET /api/v1/users/:id', () => {
    it('should return a single user', async () => {
      // Create a user first
      const createRes = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'findme@example.com',
          firstName: 'Find',
          lastName: 'Me',
          password: 'Password123!',
          userType: 'client',
        });

      const res = await request(httpServer)
        .get(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: createRes.body.id,
        email: 'findme@example.com',
        firstName: 'Find',
        lastName: 'Me',
      });
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await request(httpServer)
        .get('/api/v1/users/not-a-uuid')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(400);
    });
  });

  // --- PATCH /api/v1/users/:id ---

  describe('PATCH /api/v1/users/:id', () => {
    it('should update user fields', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'update-me@example.com',
          firstName: 'Before',
          lastName: 'Update',
          password: 'Password123!',
          userType: 'client',
        });

      const res = await request(httpServer)
        .patch(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ firstName: 'After' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('After');
      expect(res.body.lastName).toBe('Update');
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ firstName: 'Nope' });

      expect(res.status).toBe(404);
    });

    it('should return 409 if email is already taken', async () => {
      // Create two users
      await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'taken-email@example.com',
          firstName: 'Taken',
          lastName: 'Email',
          password: 'Password123!',
          userType: 'client',
        });

      const createRes = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'other-email@example.com',
          firstName: 'Other',
          lastName: 'User',
          password: 'Password123!',
          userType: 'client',
        });

      const res = await request(httpServer)
        .patch(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ email: 'taken-email@example.com' });

      expect(res.status).toBe(409);
    });

    it('should reject unknown fields', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'reject-unknown@example.com',
          firstName: 'Reject',
          lastName: 'Unknown',
          password: 'Password123!',
          userType: 'client',
        });

      const res = await request(httpServer)
        .patch(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ isAdmin: true });

      expect(res.status).toBe(400);
    });
  });

  // --- DELETE /api/v1/users/:id ---

  describe('DELETE /api/v1/users/:id', () => {
    it('should soft delete a user and return 204', async () => {
      const createRes = await request(httpServer)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          email: 'delete-me@example.com',
          firstName: 'Delete',
          lastName: 'Me',
          password: 'Password123!',
          userType: 'client',
        });

      const res = await request(httpServer)
        .delete(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(204);

      // Verify soft deleted — GET should return 404
      const getRes = await request(httpServer)
        .get(`/api/v1/users/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(httpServer)
        .delete('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(404);
    });
  });
});
