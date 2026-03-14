import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDB } from '@packages/database';
import { roles, permissions, rolePermissions, identityRoles, eq, and } from '@packages/database';
import { createTestApp } from '../../../../../../../../test/utils/app';
import { cleanDatabase } from '../../../../../../../../test/utils/db';
import { tokenFor } from '../../../../../../../../test/utils/auth';
import { IdentityFactory } from '../../../../../../../../test/factories/identityFactory';

async function upsertPermission(db: DrizzleDB, resource: string, action: string, description?: string) {
  const [existing] = await db.select().from(permissions)
    .where(and(eq(permissions.resource, resource), eq(permissions.action, action))).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(permissions).values({ resource, action, description }).returning();
  return created;
}

describe('Roles API — integration', () => {
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
    const roleName = `admin-${identity.id.slice(0, 8)}`;
    const [role] = await db.insert(roles).values({ name: roleName, description: 'Test admin' }).returning();
    const permission = await upsertPermission(db, 'rbac.roles', 'manage', 'Manage roles');
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id }).onConflictDoNothing();
    await db.insert(identityRoles).values({ identityId: identity.id, roleId: role.id });
    return identity;
  }

  describe('POST /api/v1/roles', () => {
    it('should create a role and return 201', async () => {
      const admin = await createAdminIdentity();
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

      const [saved] = await db.select().from(roles).where(eq(roles.id, res.body.id)).limit(1);
      expect(saved).not.toBeNull();
    });

    it('should return 409 for duplicate role name', async () => {
      const admin = await createAdminIdentity();
      const name = `dup-${Date.now()}`;
      await db.insert(roles).values({ name });

      const res = await request(httpServer)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name });

      expect(res.status).toBe(409);
    });

    it('should return 400 for missing name', async () => {
      const admin = await createAdminIdentity();

      const res = await request(httpServer)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/roles', () => {
    it('should list all roles', async () => {
      const admin = await createAdminIdentity();

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
      const admin = await createAdminIdentity();
      const [role] = await db.insert(roles).values({ name: `viewer-${Date.now()}` }).returning();

      const res = await request(httpServer)
        .get(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(role.id);
    });

    it('should return 404 for nonexistent role', async () => {
      const admin = await createAdminIdentity();

      const res = await request(httpServer)
        .get('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/roles/:id', () => {
    it('should update a role', async () => {
      const admin = await createAdminIdentity();
      const [role] = await db.insert(roles).values({ name: `upd-${Date.now()}` }).returning();

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
      const admin = await createAdminIdentity();
      const [role] = await db.insert(roles).values({ name: `del-${Date.now()}` }).returning();

      const res = await request(httpServer)
        .delete(`/api/v1/roles/${role.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(204);

      const [deleted] = await db.select().from(roles).where(eq(roles.id, role.id)).limit(1);
      expect(deleted).toBeUndefined();
    });
  });

  describe('PUT /api/v1/roles/:id/permissions', () => {
    it('should set role permissions', async () => {
      const admin = await createAdminIdentity();
      const [role] = await db.insert(roles).values({ name: `perm-${Date.now()}` }).returning();
      const perm = await upsertPermission(db, 'test', 'read', 'Test read');

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
      const admin = await createAdminIdentity();
      const [role] = await db.insert(roles).values({ name: `getp-${Date.now()}` }).returning();

      const res = await request(httpServer)
        .get(`/api/v1/roles/${role.id}/permissions`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/v1/roles/identities/:identityId/roles', () => {
    it('should assign role to identity', async () => {
      const admin = await createAdminIdentity();
      const targetIdentity = await IdentityFactory.create(db);
      const [role] = await db.insert(roles).values({ name: `assign-${Date.now()}` }).returning();

      const res = await request(httpServer)
        .post(`/api/v1/roles/identities/${targetIdentity.id}/roles`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ roleId: role.id });

      expect(res.status).toBe(201);
    });
  });

  describe('DELETE /api/v1/roles/identities/:identityId/roles/:roleId', () => {
    it('should remove role from identity', async () => {
      const admin = await createAdminIdentity();
      const targetIdentity = await IdentityFactory.create(db);
      const [role] = await db.insert(roles).values({ name: `rem-${Date.now()}` }).returning();
      await db.insert(identityRoles).values({ identityId: targetIdentity.id, roleId: role.id });

      const res = await request(httpServer)
        .delete(`/api/v1/roles/identities/${targetIdentity.id}/roles/${role.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`);

      expect(res.status).toBe(204);
    });
  });
});
