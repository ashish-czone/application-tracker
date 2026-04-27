import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { EntityEngineModule } from '@packages/entity-engine';
import { HierarchyModule } from '@packages/hierarchy';
import { TestOrgUnitsModule } from './helpers/test-org-units.module';
import { ORG_UNIT_PERMISSIONS } from '../../permissions';

const READ = [ORG_UNIT_PERMISSIONS.READ];
const MANAGE = [...READ, ORG_UNIT_PERMISSIONS.MANAGE];

describe('OrgUnitLevelController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [EntityEngineModule, HierarchyModule, TestOrgUnitsModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createLevel(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = { name: `Level ${seq}`, sortOrder: seq, ...overrides };
    const res = await request(ctx.httpServer)
      .post('/api/v1/org-unit-levels')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── CRUD ────────────────────────────────────────────────────

  describe('POST /api/v1/org-unit-levels', () => {
    it('should create a level', async () => {
      const level = await createLevel({ name: 'Company', sortOrder: 0 });

      expect(level).toMatchObject({
        id: expect.any(String),
        name: 'Company',
        sortOrder: 0,
      });
    });

    it('should reject missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/org-unit-levels')
        .set(withAuth(MANAGE))
        .send({ sortOrder: 0 })
        .expect(400);
    });
  });

  describe('GET /api/v1/org-unit-levels', () => {
    it('should list all levels ordered by sortOrder', async () => {
      await createLevel({ name: 'Company', sortOrder: 0 });
      await createLevel({ name: 'Division', sortOrder: 1 });
      await createLevel({ name: 'Team', sortOrder: 2 });

      const res = await request(ctx.httpServer)
        .get('/api/v1/org-unit-levels')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(3);
      expect(res.body[0].name).toBe('Company');
      expect(res.body[2].name).toBe('Team');
    });
  });

  describe('GET /api/v1/org-unit-levels/:id', () => {
    it('should return a level by ID', async () => {
      const level = await createLevel({ name: 'Entity' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/org-unit-levels/${level.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: level.id, name: 'Entity' });
    });

    it('should return 404 for non-existent ID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/org-unit-levels/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/org-unit-levels/:id', () => {
    it('should update a level name', async () => {
      const level = await createLevel({ name: 'Old' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/org-unit-levels/${level.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'New' })
        .expect(200);

      expect(res.body.name).toBe('New');
    });
  });

  describe('DELETE /api/v1/org-unit-levels/:id', () => {
    it('should delete a level not in use', async () => {
      const level = await createLevel({ name: 'Unused' });

      await request(ctx.httpServer)
        .delete(`/api/v1/org-unit-levels/${level.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/org-unit-levels/${level.id}`)
        .set(withAuth(READ))
        .expect(404);
    });

    it('should return 409 when level is in use by org units', async () => {
      const level = await createLevel({ name: 'InUse' });

      // Create an org unit using this level
      await request(ctx.httpServer)
        .post('/api/v1/org-units')
        .set(withAuth(MANAGE))
        .send({ name: 'Test Unit', levelId: level.id })
        .expect(201);

      await request(ctx.httpServer)
        .delete(`/api/v1/org-unit-levels/${level.id}`)
        .set(withAuth(MANAGE))
        .expect(409);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/org-unit-levels')
        .expect(401);
    });

    it('should return 403 with read-only on write endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/org-unit-levels')
        .set(withAuth(READ))
        .send({ name: 'Test' })
        .expect(403);
    });
  });
});
