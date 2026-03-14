import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createTestApp } from '../../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../../test/utils/db';
import { tokenFor } from '../../../../../../../../test/utils/auth';
import { UserFactory } from '../../../../../../../../test/factories/userFactory';

describe('Roles API — integration', () => {
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

  async function createAdminUser() {
    const user = await UserFactory.create(prisma);
    const roleName = `admin-${user.id.slice(0, 8)}`;
    const role = await prisma.role.create({
      data: { name: roleName, description: 'Test admin' },
    });
    const permission = await prisma.permission.upsert({
      where: { resource_action: { resource: 'rbac.roles', action: 'manage' } },
      create: { resource: 'rbac.roles', action: 'manage', description: 'Manage roles' },
      update: {},
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      create: { roleId: role.id, permissionId: permission.id },
      update: {},
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    return user;
  }

  describe('POST /api/v1/roles', () => {
    it('should create a role and return 201', async () => {
      const admin = await createAdminUser();
      const name = `editor-${Date.now()}`;

      const res = await request(httpServer)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name, description: 'Can edit content' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name,
        description: 'Can edit content',
      });

      const saved = await prisma.role.findUnique({ where: { id: res.body.id } });
      expect(saved).not.toBeNull();
    });

    it('should return 409 for duplicate role name', async () => {
      const admin = await createAdminUser();
      const name = `dup-${Date.now()}`;
      await prisma.role.create({ data: { name } });

      const res = await request(httpServer)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name });

      expect(res.status).toBe(409);
    });

    it('should return 400 for missing name', async () => {
      const admin = await createAdminUser();

      const res = await request(httpServer)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/roles', () => {
    it('should list all roles', async () => {
      const admin = await createAdminUser();

      const res = await request(httpServer)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/roles/:id', () => {
    it('should return a role by id', async () => {
      const admin = await createAdminUser();
      const role = await prisma.role.create({ data: { name: `viewer-${Date.now()}` } });

      const res = await request(httpServer)
        .get(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(role.id);
    });

    it('should return 404 for nonexistent role', async () => {
      const admin = await createAdminUser();

      const res = await request(httpServer)
        .get('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/roles/:id', () => {
    it('should update a role', async () => {
      const admin = await createAdminUser();
      const role = await prisma.role.create({ data: { name: `upd-${Date.now()}` } });

      const res = await request(httpServer)
        .patch(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated description');
    });
  });

  describe('DELETE /api/v1/roles/:id', () => {
    it('should delete a role and return 204', async () => {
      const admin = await createAdminUser();
      const role = await prisma.role.create({ data: { name: `del-${Date.now()}` } });

      const res = await request(httpServer)
        .delete(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(204);

      const deleted = await prisma.role.findUnique({ where: { id: role.id } });
      expect(deleted).toBeNull();
    });
  });

  describe('PUT /api/v1/roles/:id/permissions', () => {
    it('should set role permissions', async () => {
      const admin = await createAdminUser();
      const role = await prisma.role.create({ data: { name: `perm-${Date.now()}` } });
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource: 'test', action: 'read' } },
        create: { resource: 'test', action: 'read', description: 'Test read' },
        update: {},
      });

      const res = await request(httpServer)
        .put(`/api/v1/roles/${role.id}/permissions`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ permissionIds: [perm.id] });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });
  });

  describe('GET /api/v1/roles/:id/permissions', () => {
    it('should get role permissions', async () => {
      const admin = await createAdminUser();
      const role = await prisma.role.create({ data: { name: `getp-${Date.now()}` } });

      const res = await request(httpServer)
        .get(`/api/v1/roles/${role.id}/permissions`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/v1/roles/users/:userId/roles', () => {
    it('should assign role to user', async () => {
      const admin = await createAdminUser();
      const targetUser = await UserFactory.create(prisma);
      const role = await prisma.role.create({ data: { name: `assign-${Date.now()}` } });

      const res = await request(httpServer)
        .post(`/api/v1/roles/users/${targetUser.id}/roles`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ roleId: role.id });

      expect(res.status).toBe(201);
    });
  });

  describe('DELETE /api/v1/roles/users/:userId/roles/:roleId', () => {
    it('should remove role from user', async () => {
      const admin = await createAdminUser();
      const targetUser = await UserFactory.create(prisma);
      const role = await prisma.role.create({ data: { name: `rem-${Date.now()}` } });
      await prisma.userRole.create({ data: { userId: targetUser.id, roleId: role.id } });

      const res = await request(httpServer)
        .delete(`/api/v1/roles/users/${targetUser.id}/roles/${role.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(204);
    });
  });
});
