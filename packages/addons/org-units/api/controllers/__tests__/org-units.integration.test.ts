import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { HierarchyModule } from '@packages/hierarchy';
import { TestOrgUnitsModule } from './helpers/test-org-units.module';
import { ORG_UNIT_PERMISSIONS } from '../../permissions';

const READ = [ORG_UNIT_PERMISSIONS.READ];
const MANAGE = [...READ, ORG_UNIT_PERMISSIONS.MANAGE];

describe('OrgUnitController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [HierarchyModule, TestOrgUnitsModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;
  let defaultLevelId: string;

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    seq = 0;
    // Seed a default level for tests
    const levelRes = await request(ctx.httpServer)
      .post('/api/v1/org-unit-levels')
      .set(withAuth(MANAGE))
      .send({ name: 'Team', sortOrder: 0 })
      .expect(201);
    defaultLevelId = levelRes.body.id;
  });

  async function createOrgUnit(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: `Department ${seq}`,
      levelId: defaultLevelId,
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/org-units')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── CRUD ────────────────────────────────────────────────────

  describe('POST /api/v1/org-units', () => {
    it('should create an org unit', async () => {
      const unit = await createOrgUnit({ name: 'Engineering' });

      expect(unit).toMatchObject({
        id: expect.any(String),
        name: 'Engineering',
        levelId: defaultLevelId,
      });
    });

    it('should create a child org unit', async () => {
      const parent = await createOrgUnit({ name: 'Engineering' });
      const child = await createOrgUnit({ name: 'Frontend', parentId: parent.id });

      expect(child).toMatchObject({
        name: 'Frontend',
        parentId: parent.id,
      });
    });

    it('should reject missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/org-units')
        .set(withAuth(MANAGE))
        .send({ levelId: defaultLevelId })
        .expect(400);
    });

    it('should reject missing levelId', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/org-units')
        .set(withAuth(MANAGE))
        .send({ name: 'Test' })
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/org-units')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', levelId: defaultLevelId, hackField: 'injected' })
        .expect(400);
    });
  });

  describe('GET /api/v1/org-units', () => {
    it('should list all org units with level and head info', async () => {
      await createOrgUnit({ name: 'Alpha' });
      await createOrgUnit({ name: 'Beta' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/org-units')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0]).toHaveProperty('level');
      expect(res.body[0]).toHaveProperty('head');
      expect(res.body[0]).toHaveProperty('memberCount');
    });
  });

  describe('GET /api/v1/org-units/:id', () => {
    it('should return an org unit by ID', async () => {
      const unit = await createOrgUnit({ name: 'Lookup Unit' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/org-units/${unit.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: unit.id, name: 'Lookup Unit' });
    });

    it('should return 404 for non-existent ID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/org-units/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/org-units/not-a-uuid')
        .set(withAuth(READ))
        .expect(400);
    });
  });

  describe('PATCH /api/v1/org-units/:id', () => {
    it('should update an org unit name', async () => {
      const unit = await createOrgUnit({ name: 'Old Name' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/org-units/${unit.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
    });

    it('should persist and return description on create and list', async () => {
      const unit = await createOrgUnit({ name: 'Described', description: 'What this unit does' });
      expect(unit.description).toBe('What this unit does');

      const res = await request(ctx.httpServer)
        .get('/api/v1/org-units')
        .set(withAuth(READ))
        .expect(200);

      const fetched = (res.body as Array<{ id: string; description: string | null }>).find(
        (u) => u.id === unit.id,
      );
      expect(fetched?.description).toBe('What this unit does');
    });

    it('should update description', async () => {
      const unit = await createOrgUnit({ name: 'No desc yet' });
      expect(unit.description).toBeNull();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/org-units/${unit.id}`)
        .set(withAuth(MANAGE))
        .send({ description: 'Now described' })
        .expect(200);

      expect(res.body.description).toBe('Now described');
    });
  });

  describe('DELETE /api/v1/org-units/:id', () => {
    it('should delete an org unit', async () => {
      const unit = await createOrgUnit();

      await request(ctx.httpServer)
        .delete(`/api/v1/org-units/${unit.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/org-units/${unit.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Members ─────────────────────────────────────────────────

  describe('Members', () => {
    let testUserId: string;

    beforeEach(async () => {
      testUserId = randomUUID();
      await ctx.db.execute(
        sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at) VALUES (${testUserId}, ${`member-${Date.now()}@example.com`}, ${'Member'}, ${'User'}, ${'admin'}, NOW())`,
      );
    });

    it('should add a member to an org unit', async () => {
      const unit = await createOrgUnit({ name: 'Team' });

      await request(ctx.httpServer)
        .post(`/api/v1/org-units/${unit.id}/members/${testUserId}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });

    it('should list members with details', async () => {
      const unit = await createOrgUnit({ name: 'Team' });
      await request(ctx.httpServer)
        .post(`/api/v1/org-units/${unit.id}/members/${testUserId}`)
        .set(withAuth(MANAGE))
        .expect(204);

      const res = await request(ctx.httpServer)
        .get(`/api/v1/org-units/${unit.id}/members`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('userId');
      expect(res.body[0]).toHaveProperty('userName');
      expect(res.body[0]).toHaveProperty('positionId');
      expect(res.body[0]).toHaveProperty('positionName');
    });

    it('should remove a member from an org unit', async () => {
      const unit = await createOrgUnit({ name: 'Team' });
      await request(ctx.httpServer)
        .post(`/api/v1/org-units/${unit.id}/members/${testUserId}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .delete(`/api/v1/org-units/${unit.id}/members/${testUserId}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/org-units')
        .expect(401);
    });

    it('should return 403 with read-only on write endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/org-units')
        .set(withAuth(READ))
        .send({ name: 'Test', levelId: defaultLevelId })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/org-units')
        .set(withAuth(['*']))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
