import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createTestApp } from '../../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../../test/utils/db';
import { tokenFor } from '../../../../../../../../test/utils/auth';
import { UserFactory } from '../../../../../../../../test/factories/userFactory';

describe('Permissions API — integration', () => {
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
    const roleName = `perm-admin-${user.id.slice(0, 8)}`;
    const role = await prisma.role.create({
      data: { name: roleName, description: 'Test admin' },
    });
    const permission = await prisma.permission.upsert({
      where: { resource_action: { resource: 'rbac.roles', action: 'manage' } },
      create: { resource: 'rbac.roles', action: 'manage' },
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

  describe('GET /api/v1/permissions', () => {
    it('should list all permissions', async () => {
      const admin = await createAdminUser();

      const res = await request(httpServer)
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/permissions/registry', () => {
    it('should return the permission registry', async () => {
      const admin = await createAdminUser();

      const res = await request(httpServer)
        .get('/api/v1/permissions/registry')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/roles/users/:id/roles', () => {
    it('should return user roles', async () => {
      const admin = await createAdminUser();
      const user = await UserFactory.create(prisma);

      const res = await request(httpServer)
        .get(`/api/v1/roles/users/${user.id}/roles`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
