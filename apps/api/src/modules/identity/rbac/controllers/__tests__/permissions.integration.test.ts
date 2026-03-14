import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDB } from '@packages/database';
import { roles, permissions, rolePermissions, identityRoles, eq, and } from '@packages/database';
import { createTestApp } from '../../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../../test/utils/db';
import { tokenFor } from '../../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../../test/factories/identityFactory';

async function upsertPermission(db: DrizzleDB, resource: string, action: string) {
  const [existing] = await db.select().from(permissions)
    .where(and(eq(permissions.resource, resource), eq(permissions.action, action))).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(permissions).values({ resource, action }).returning();
  return created;
}

describe('Permissions API — integration', () => {
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

  async function createAdminIdentity() {
    const identity = await IdentityFactory.create(db);
    const roleName = `perm-admin-${identity.id.slice(0, 8)}`;
    const [role] = await db.insert(roles).values({ name: roleName, description: 'Test admin' }).returning();
    const rolesManage = await upsertPermission(db, 'rbac.roles', 'manage');
    const permissionsRead = await upsertPermission(db, 'rbac.permissions', 'read');
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: rolesManage.id }).onConflictDoNothing();
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permissionsRead.id }).onConflictDoNothing();
    await db.insert(identityRoles).values({ identityId: identity.id, roleId: role.id });
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
      const identity = await IdentityFactory.create(db);

      const res = await request(httpServer)
        .get(`/api/v1/roles/identities/${identity.id}/roles`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
