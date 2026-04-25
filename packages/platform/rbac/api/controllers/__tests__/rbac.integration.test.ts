import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { users } from '@packages/database';
import { RBAC_PERMISSIONS } from '../../permissions';

const READ = [RBAC_PERMISSIONS.ROLES_READ];
const MANAGE = [...READ, RBAC_PERMISSIONS.ROLES_MANAGE];
const PERMS_READ = [RBAC_PERMISSIONS.PERMISSIONS_READ];
const ALL = [...MANAGE, ...PERMS_READ];

describe('RbacController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    // RbacModule is auto-included by createPackageTestApp
    ctx = await createPackageTestApp({});
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createRole(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: `Test Role ${Date.now()}-${seq}`,
      userType: 'admin',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/roles')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── Roles CRUD ──────────────────────────────────────────────

  describe('POST /api/v1/roles', () => {
    it('should create a role', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/roles')
        .set(withAuth(MANAGE))
        .send({ name: 'Manager', userType: 'admin' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: 'Manager',
        userType: 'admin',
      });
    });

    it('should create a client role', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/roles')
        .set(withAuth(MANAGE))
        .send({ name: 'Viewer', userType: 'client', isDefault: true })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Viewer',
        userType: 'client',
      });
    });

    it('should accept a null/omitted userType', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/roles')
        .set(withAuth(MANAGE))
        .send({ name: 'Unscoped Role' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Unscoped Role',
        userType: null,
      });
    });

    it('should reject short name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/roles')
        .set(withAuth(MANAGE))
        .send({ name: 'A', userType: 'admin' })
        .expect(400);
    });
  });

  describe('GET /api/v1/roles', () => {
    it('should list roles', async () => {
      await createRole({ name: 'Alpha' });
      await createRole({ name: 'Beta' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/roles')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta).toMatchObject({
        total: 2,
        page: 1,
      });
    });

    it('should filter by userType', async () => {
      await createRole({ name: 'Admin Role', userType: 'admin' });
      await createRole({ name: 'Client Role', userType: 'client' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/roles?userType=client')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].userType).toBe('client');
    });

    it('should search by name', async () => {
      await createRole({ name: 'Super Admin' });
      await createRole({ name: 'Basic User' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/roles?search=Super')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Super Admin');
    });

    it('should paginate', async () => {
      for (let i = 0; i < 5; i++) {
        await createRole({ name: `Role ${i}` });
      }

      const res = await request(ctx.httpServer)
        .get('/api/v1/roles?page=2&limit=2')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.meta.total).toBe(5);
      expect(res.body.meta.page).toBe(2);
    });
  });

  describe('GET /api/v1/roles/:id', () => {
    it('should return a role by id', async () => {
      const role = await createRole({ name: 'Specific Role' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/roles/${role.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.name).toBe('Specific Role');
    });

    it('should 404 for non-existent role', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/roles/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/roles/:id', () => {
    it('should update a role name', async () => {
      const role = await createRole({ name: 'Old Name' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/roles/${role.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
    });
  });

  describe('DELETE /api/v1/roles/:id', () => {
    it('should delete a role with no users', async () => {
      const role = await createRole();

      await request(ctx.httpServer)
        .delete(`/api/v1/roles/${role.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      // Verify deleted
      await request(ctx.httpServer)
        .get(`/api/v1/roles/${role.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('GET /api/v1/roles/:id/user-count', () => {
    it('should return zero for a role with no users', async () => {
      const role = await createRole();

      const res = await request(ctx.httpServer)
        .get(`/api/v1/roles/${role.id}/user-count`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.count).toBe(0);
    });
  });

  // ── Role Permissions ──────────────────────────────────────────────

  describe('GET /api/v1/roles/:id/permissions', () => {
    it('should return empty permissions for a new role', async () => {
      const role = await createRole();

      const res = await request(ctx.httpServer)
        .get(`/api/v1/roles/${role.id}/permissions`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toEqual({});
    });
  });

  describe('PUT /api/v1/roles/:id/permissions', () => {
    it('should set permissions on a role', async () => {
      const role = await createRole();

      // Use superadmin — the endpoint checks that the actor has the permissions being granted.
      // Use rbac permissions (registered by RbacModule) since the test app only loads RbacModule;
      // arbitrary permissions like users.read would fail manifest validation.
      const res = await request(ctx.httpServer)
        .put(`/api/v1/roles/${role.id}/permissions`)
        .set(withAuth(['*']))
        .send({
          permissions: [
            { name: RBAC_PERMISSIONS.ROLES_READ },
            { name: RBAC_PERMISSIONS.ROLES_MANAGE },
          ],
        })
        .expect(200);

      expect(res.body).toHaveProperty(RBAC_PERMISSIONS.ROLES_READ);
      expect(res.body).toHaveProperty(RBAC_PERMISSIONS.ROLES_MANAGE);
    });

    it('should replace permissions on a role', async () => {
      const role = await createRole();

      // Set initial
      await request(ctx.httpServer)
        .put(`/api/v1/roles/${role.id}/permissions`)
        .set(withAuth(['*']))
        .send({
          permissions: [
            { name: RBAC_PERMISSIONS.ROLES_READ },
            { name: RBAC_PERMISSIONS.ROLES_MANAGE },
          ],
        })
        .expect(200);

      // Replace
      const res = await request(ctx.httpServer)
        .put(`/api/v1/roles/${role.id}/permissions`)
        .set(withAuth(['*']))
        .send({ permissions: [{ name: RBAC_PERMISSIONS.PERMISSIONS_READ }] })
        .expect(200);

      expect(res.body).toHaveProperty(RBAC_PERMISSIONS.PERMISSIONS_READ);
      expect(res.body).not.toHaveProperty(RBAC_PERMISSIONS.ROLES_READ);
    });
  });

  // ── Permission Manifests ──────────────────────────────────────────────

  describe('GET /api/v1/permission-manifests', () => {
    it('should list registered permission manifests', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/permission-manifests')
        .set(withAuth(PERMS_READ))
        .expect(200);

      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            module: 'rbac',
            slug: expect.stringMatching(/^rbac\./),
            action: expect.any(String),
            label: expect.any(String),
            supportedScopes: expect.any(Array),
          }),
        ]),
      );
    });
  });

  // ── Role Members ──────────────────────────────────────────────

  describe('Role members endpoints', () => {
    async function createUser(userType = 'admin') {
      const [user] = await ctx.db
        .insert(users)
        .values({
          email: `member-${randomUUID()}@example.com`,
          firstName: 'Member',
          lastName: 'User',
          userType,
        })
        .returning();
      return user;
    }

    describe('GET /api/v1/roles/:id/members', () => {
      it('should list members of a role', async () => {
        const role = await createRole();
        const user = await createUser();
        await request(ctx.httpServer)
          .post(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(MANAGE))
          .send({ userId: user.id })
          .expect(201);

        const res = await request(ctx.httpServer)
          .get(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(READ))
          .expect(200);

        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].id).toBe(user.id);
        expect(res.body.meta.total).toBe(1);
      });

      it('should return empty list for a role with no members', async () => {
        const role = await createRole();
        const res = await request(ctx.httpServer)
          .get(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(READ))
          .expect(200);
        expect(res.body.data).toEqual([]);
        expect(res.body.meta.total).toBe(0);
      });

      it('should 404 when role does not exist', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/roles/${randomUUID()}/members`)
          .set(withAuth(READ))
          .expect(404);
      });
    });

    describe('POST /api/v1/roles/:id/members', () => {
      it('should add a member to a role and return member with addedAt', async () => {
        const role = await createRole();
        const user = await createUser();

        const res = await request(ctx.httpServer)
          .post(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(MANAGE))
          .send({ userId: user.id })
          .expect(201);

        expect(res.body.id).toBe(user.id);
        expect(res.body.email).toBe(user.email);
        expect(res.body.addedAt).toBeDefined();
      });

      it('should be idempotent when adding the same member twice', async () => {
        const role = await createRole();
        const user = await createUser();

        await request(ctx.httpServer)
          .post(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(MANAGE))
          .send({ userId: user.id })
          .expect(201);
        await request(ctx.httpServer)
          .post(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(MANAGE))
          .send({ userId: user.id })
          .expect(201);

        const res = await request(ctx.httpServer)
          .get(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(READ))
          .expect(200);
        expect(res.body.data).toHaveLength(1);
      });

      it('should 400 for an invalid userId', async () => {
        const role = await createRole();
        await request(ctx.httpServer)
          .post(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(MANAGE))
          .send({ userId: 'not-a-uuid' })
          .expect(400);
      });
    });

    describe('DELETE /api/v1/roles/:id/members/:userId', () => {
      it('should remove a member from a role', async () => {
        const role = await createRole();
        const user = await createUser();
        await request(ctx.httpServer)
          .post(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(MANAGE))
          .send({ userId: user.id })
          .expect(201);

        await request(ctx.httpServer)
          .delete(`/api/v1/roles/${role.id}/members/${user.id}`)
          .set(withAuth(MANAGE))
          .expect(204);

        const res = await request(ctx.httpServer)
          .get(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(READ))
          .expect(200);
        expect(res.body.data).toHaveLength(0);
      });

      it('should 404 when role does not exist', async () => {
        const user = await createUser();
        await request(ctx.httpServer)
          .delete(`/api/v1/roles/${randomUUID()}/members/${user.id}`)
          .set(withAuth(MANAGE))
          .expect(404);
      });
    });

    describe('Member endpoints — auth enforcement', () => {
      it('GET /members should 401 without auth', async () => {
        const role = await createRole();
        await request(ctx.httpServer)
          .get(`/api/v1/roles/${role.id}/members`)
          .expect(401);
      });

      it('GET /members should 403 without rbac.roles.read', async () => {
        const role = await createRole();
        await request(ctx.httpServer)
          .get(`/api/v1/roles/${role.id}/members`)
          .set(withAuth([]))
          .expect(403);
      });

      it('POST /members should 401 without auth', async () => {
        const role = await createRole();
        const user = await createUser();
        await request(ctx.httpServer)
          .post(`/api/v1/roles/${role.id}/members`)
          .send({ userId: user.id })
          .expect(401);
      });

      it('POST /members should 403 without rbac.roles.manage', async () => {
        const role = await createRole();
        const user = await createUser();
        await request(ctx.httpServer)
          .post(`/api/v1/roles/${role.id}/members`)
          .set(withAuth(READ))
          .send({ userId: user.id })
          .expect(403);
      });

      it('DELETE /members should 401 without auth', async () => {
        const role = await createRole();
        const user = await createUser();
        await request(ctx.httpServer)
          .delete(`/api/v1/roles/${role.id}/members/${user.id}`)
          .expect(401);
      });

      it('DELETE /members should 403 without rbac.roles.manage', async () => {
        const role = await createRole();
        const user = await createUser();
        await request(ctx.httpServer)
          .delete(`/api/v1/roles/${role.id}/members/${user.id}`)
          .set(withAuth(READ))
          .expect(403);
      });
    });
  });

  // ── Auth guard ──────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('should return 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/roles')
        .expect(401);
    });
  });
});
