import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createTestApp } from '../../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../../test/utils/db';
import { tokenFor } from '../../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../../test/factories/identityFactory';

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

  async function createAdminIdentity() {
    const identity = await IdentityFactory.create(prisma);
    const roleName = `perm-admin-${identity.id.slice(0, 8)}`;
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
    await prisma.identityRole.create({
      data: { identityId: identity.id, roleId: role.id },
    });
    return identity;
  }

  describe('GET /api/v1/permissions', () => {
    it('should list all permissions', async () => {
      const admin = await createAdminIdentity();

      const res = await request(httpServer)
        .get('/api/v1/permissions')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/permissions/registry', () => {
    it('should return the permission registry', async () => {
      const admin = await createAdminIdentity();

      const res = await request(httpServer)
        .get('/api/v1/permissions/registry')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/v1/roles/identities/:id/roles', () => {
    it('should return identity roles', async () => {
      const admin = await createAdminIdentity();
      const identity = await IdentityFactory.create(prisma);

      const res = await request(httpServer)
        .get(`/api/v1/roles/identities/${identity.id}/roles`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
