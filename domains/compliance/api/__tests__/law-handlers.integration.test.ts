import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import { createLaw, createOrgUnit, createOrgUnitLevel } from './setup/fixtures';

// Note: slug is `compliance_law_handlers` (underscore), not a dash. The
// generic CRUD routes inherit the slug verbatim.
const READ = ['compliance_law_handlers.read'];
const MANAGE = [
  'compliance_law_handlers.read',
  'compliance_law_handlers.create',
  'compliance_law_handlers.update',
  'compliance_law_handlers.delete',
];

describe('Law Handlers (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createComplianceTestApp();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await resetComplianceTestDb(ctx);
  });

  async function prereqs() {
    const { id: lawId } = await createLaw(ctx.db);
    const { id: levelId } = await createOrgUnitLevel(ctx.db);
    const { id: orgEntityId } = await createOrgUnit(ctx.db, levelId);
    return { lawId, orgEntityId };
  }

  describe('POST /api/v1/compliance_law_handlers', () => {
    it('creates a law handler', async () => {
      const { lawId, orgEntityId } = await prereqs();

      const res = await request(ctx.httpServer)
        .post('/api/v1/compliance_law_handlers')
        .set(withAuth(MANAGE))
        .send({ lawId, orgEntityId, isPrimary: true })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        lawId,
        orgEntityId,
        isPrimary: true,
      });
    });

    it('rejects missing lawId', async () => {
      const { orgEntityId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/compliance_law_handlers')
        .set(withAuth(MANAGE))
        .send({ orgEntityId, isPrimary: true })
        .expect(400);
    });

    it('rejects missing orgEntityId', async () => {
      const { lawId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/compliance_law_handlers')
        .set(withAuth(MANAGE))
        .send({ lawId, isPrimary: true })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/compliance_law_handlers')
        .send({})
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      const { lawId, orgEntityId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/compliance_law_handlers')
        .set(withAuth(READ))
        .send({ lawId, orgEntityId, isPrimary: true })
        .expect(403);
    });
  });

  describe('GET /api/v1/compliance_law_handlers', () => {
    it('lists handlers', async () => {
      const { lawId, orgEntityId } = await prereqs();
      const { id: lawB } = await createLaw(ctx.db);

      await request(ctx.httpServer)
        .post('/api/v1/compliance_law_handlers')
        .set(withAuth(MANAGE))
        .send({ lawId, orgEntityId, isPrimary: true })
        .expect(201);
      await request(ctx.httpServer)
        .post('/api/v1/compliance_law_handlers')
        .set(withAuth(MANAGE))
        .send({ lawId: lawB, orgEntityId, isPrimary: true })
        .expect(201);

      const res = await request(ctx.httpServer)
        .get('/api/v1/compliance_law_handlers')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('PATCH /api/v1/compliance_law_handlers/:id', () => {
    it('updates a handler', async () => {
      const { lawId, orgEntityId } = await prereqs();
      const created = await request(ctx.httpServer)
        .post('/api/v1/compliance_law_handlers')
        .set(withAuth(MANAGE))
        .send({ lawId, orgEntityId, isPrimary: false })
        .expect(201);

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/compliance_law_handlers/${created.body.id}`)
        .set(withAuth(MANAGE))
        .send({ isPrimary: true })
        .expect(200);

      expect(res.body.isPrimary).toBe(true);
    });
  });

  describe('DELETE /api/v1/compliance_law_handlers/:id', () => {
    it('accepts the delete request', async () => {
      const { lawId, orgEntityId } = await prereqs();
      const created = await request(ctx.httpServer)
        .post('/api/v1/compliance_law_handlers')
        .set(withAuth(MANAGE))
        .send({ lawId, orgEntityId, isPrimary: true })
        .expect(201);

      await request(ctx.httpServer)
        .delete(`/api/v1/compliance_law_handlers/${created.body.id}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });
  });
});
