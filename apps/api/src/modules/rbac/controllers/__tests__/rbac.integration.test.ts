import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { RbacService } from '@packages/rbac';
import { createTestApp } from '../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../test/utils/db';
import { createTestIdentity, type TestIdentity } from '../../../../../../../test/utils/identity';
import { RBAC_PERMISSIONS } from '../../permissions';

describe('RbacController (integration)', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: DrizzleDB;
  let httpServer: any;
  let adminIdentity: TestIdentity;
  let rbacService: RbacService;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    module = testApp.module;
    db = testApp.db;
    httpServer = testApp.httpServer;
    rbacService = module.get(RbacService);

    adminIdentity = await createTestIdentity(module, db, {
      userType: 'admin',
      permissions: [
        RBAC_PERMISSIONS.ROLES_READ,
        RBAC_PERMISSIONS.ROLES_MANAGE,
        RBAC_PERMISSIONS.PERMISSIONS_READ,
        'users.create',
        'users.read',
        'users.delete',
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase(db);
    await app.close();
  });

  // --- POST /api/v1/roles ---

  describe('POST /api/v1/roles', () => {
    it('should create a role and return 201', async () => {
      const res = await request(httpServer)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ name: 'editor', userType: 'admin' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'editor',
        userType: 'admin',
        isDefault: false,
      });
    });

    it('should return 400 for missing name', async () => {
      const res = await request(httpServer)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ userType: 'admin' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid userType', async () => {
      const res = await request(httpServer)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ name: 'test', userType: 'invalid' });

      expect(res.status).toBe(400);
    });
  });

  // --- GET /api/v1/roles ---

  describe('GET /api/v1/roles', () => {
    it('should return paginated list of roles', async () => {
      const res = await request(httpServer)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        total: expect.any(Number),
        page: 1,
        limit: 25,
      });
    });

    it('should filter by userType', async () => {
      const res = await request(httpServer)
        .get('/api/v1/roles?userType=admin')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      for (const role of res.body.data) {
        expect(role.userType).toBe('admin');
      }
    });

    it('should search by name', async () => {
      const res = await request(httpServer)
        .get('/api/v1/roles?search=editor')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((r: any) => r.name === 'editor')).toBe(true);
    });
  });

  // --- GET /api/v1/roles/:id ---

  describe('GET /api/v1/roles/:id', () => {
    it('should return a single role', async () => {
      const role = await rbacService.createRole({ name: 'viewer-test', userType: 'admin' });

      const res = await request(httpServer)
        .get(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: role.id,
        name: 'viewer-test',
        userType: 'admin',
      });
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(httpServer)
        .get('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await request(httpServer)
        .get('/api/v1/roles/not-a-uuid')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(400);
    });
  });

  // --- PATCH /api/v1/roles/:id ---

  describe('PATCH /api/v1/roles/:id', () => {
    it('should update role name', async () => {
      const role = await rbacService.createRole({ name: 'rename-me', userType: 'admin' });

      const res = await request(httpServer)
        .patch(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ name: 'renamed' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('renamed');
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(httpServer)
        .patch('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({ name: 'nope' });

      expect(res.status).toBe(404);
    });
  });

  // --- DELETE /api/v1/roles/:id ---

  describe('DELETE /api/v1/roles/:id', () => {
    it('should delete a role with no assigned users', async () => {
      const role = await rbacService.createRole({ name: 'delete-me', userType: 'client' });

      const res = await request(httpServer)
        .delete(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(204);

      // Verify it's gone
      const getRes = await request(httpServer)
        .get(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(getRes.status).toBe(404);
    });

    it('should return 409 for default role', async () => {
      const role = await rbacService.createRole({ name: 'default-no-delete', userType: 'admin', isDefault: true });

      const res = await request(httpServer)
        .delete(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(409);
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(httpServer)
        .delete('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  // --- GET /api/v1/roles/:id/permissions ---

  describe('GET /api/v1/roles/:id/permissions', () => {
    it('should return role permissions with scopes', async () => {
      const role = await rbacService.createRole({ name: 'perm-test', userType: 'admin' });
      await rbacService.setRolePermissions(role.id, [
        { name: 'users.read', scope: 'all' },
        { name: 'users.update', scope: 'own' },
      ]);

      const res = await request(httpServer)
        .get(`/api/v1/roles/${role.id}/permissions`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        'users.read': 'all',
        'users.update': 'own',
      });
    });

    it('should return 404 for non-existent role', async () => {
      const res = await request(httpServer)
        .get('/api/v1/roles/00000000-0000-0000-0000-000000000000/permissions')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(404);
    });
  });

  // --- PUT /api/v1/roles/:id/permissions ---

  describe('PUT /api/v1/roles/:id/permissions', () => {
    it('should set role permissions and return updated list', async () => {
      const role = await rbacService.createRole({ name: 'set-perms', userType: 'admin' });

      const res = await request(httpServer)
        .put(`/api/v1/roles/${role.id}/permissions`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          permissions: [
            { name: 'users.create', scope: 'all' },
            { name: 'users.read', scope: 'own' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        'users.create': 'all',
        'users.read': 'own',
      });
    });

    it('should replace existing permissions', async () => {
      const role = await rbacService.createRole({ name: 'replace-perms', userType: 'admin' });
      await rbacService.setRolePermissions(role.id, [{ name: 'users.read', scope: 'all' }]);

      const res = await request(httpServer)
        .put(`/api/v1/roles/${role.id}/permissions`)
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`)
        .send({
          permissions: [{ name: 'users.delete', scope: 'all' }],
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ 'users.delete': 'all' });
      expect(res.body).not.toHaveProperty('users.read');
    });
  });

  // --- GET /api/v1/permissions/registry ---

  describe('GET /api/v1/permissions/registry', () => {
    it('should return registered permissions', async () => {
      const res = await request(httpServer)
        .get('/api/v1/permissions/registry')
        .set('Authorization', `Bearer ${adminIdentity.accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('module');
      expect(res.body[0]).toHaveProperty('action');
      expect(res.body[0]).toHaveProperty('description');
    });
  });
});
