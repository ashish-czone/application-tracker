import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { EntityEngineModule } from '@packages/entity-engine';
import { HierarchyModule } from '@packages/hierarchy';
import { OrgUnitsModule } from '../../org-units.module';
import { ORG_UNIT_PERMISSIONS } from '../../permissions';

const READ = [ORG_UNIT_PERMISSIONS.READ];
const MANAGE = [...READ, ORG_UNIT_PERMISSIONS.MANAGE];

describe('OrgPositionController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [EntityEngineModule, HierarchyModule, OrgUnitsModule],
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

  async function createPosition(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: `Position ${seq}`,
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/org-positions')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── CRUD ────────────────────────────────────────────────────

  describe('POST /api/v1/org-positions', () => {
    it('should create an org position', async () => {
      const position = await createPosition({ name: 'Team Lead' });

      expect(position).toMatchObject({
        id: expect.any(String),
        name: 'Team Lead',
      });
    });

    it('should reject missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/org-positions')
        .set(withAuth(MANAGE))
        .send({})
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/org-positions')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', hackField: 'injected' })
        .expect(400);
    });
  });

  describe('GET /api/v1/org-positions', () => {
    it('should list all org positions', async () => {
      await createPosition({ name: 'Manager' });
      await createPosition({ name: 'Director' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/org-positions')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/v1/org-positions/:id', () => {
    it('should return a position by ID', async () => {
      const position = await createPosition({ name: 'CTO' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/org-positions/${position.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: position.id, name: 'CTO' });
    });

    it('should return 404 for non-existent ID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/org-positions/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/org-positions/not-a-uuid')
        .set(withAuth(READ))
        .expect(400);
    });
  });

  describe('PATCH /api/v1/org-positions/:id', () => {
    it('should update a position name', async () => {
      const position = await createPosition({ name: 'Old Name' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/org-positions/${position.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
    });
  });

  describe('DELETE /api/v1/org-positions/:id', () => {
    it('should delete a position', async () => {
      const position = await createPosition();

      await request(ctx.httpServer)
        .delete(`/api/v1/org-positions/${position.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/org-positions/${position.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/org-positions')
        .expect(401);
    });

    it('should return 403 with read-only on write endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/org-positions')
        .set(withAuth(READ))
        .send({ name: 'Test' })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/org-positions')
        .set(withAuth(['*']))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
