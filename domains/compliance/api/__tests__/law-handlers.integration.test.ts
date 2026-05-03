import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import { createLaw, createOrgUnit, createOrgUnitLevel } from './setup/fixtures';

// Note: slug is `law-handlers` (underscore), not a dash. The
// generic CRUD routes inherit the slug verbatim.
const READ = ['law-handlers.read'];
const MANAGE = [
  'law-handlers.read',
  'law-handlers.create',
  'law-handlers.update',
  'law-handlers.delete',
];
// Authenticated but holds zero compliance perms — drives 403 on the
// pure-read endpoints whose only `@RequirePermission` is `*.read`.
const NO_PERMS: string[] = [];

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

  describe('POST /api/v1/law-handlers', () => {
    it('creates a law handler', async () => {
      const { lawId, orgEntityId } = await prereqs();

      const res = await request(ctx.httpServer)
        .post('/api/v1/law-handlers')
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
        .post('/api/v1/law-handlers')
        .set(withAuth(MANAGE))
        .send({ orgEntityId, isPrimary: true })
        .expect(400);
    });

    it('rejects missing orgEntityId', async () => {
      const { lawId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/law-handlers')
        .set(withAuth(MANAGE))
        .send({ lawId, isPrimary: true })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/law-handlers')
        .send({})
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      const { lawId, orgEntityId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/law-handlers')
        .set(withAuth(READ))
        .send({ lawId, orgEntityId, isPrimary: true })
        .expect(403);
    });
  });

  describe('GET /api/v1/law-handlers', () => {
    it('lists handlers', async () => {
      const { lawId, orgEntityId } = await prereqs();
      const { id: lawB } = await createLaw(ctx.db);

      await request(ctx.httpServer)
        .post('/api/v1/law-handlers')
        .set(withAuth(MANAGE))
        .send({ lawId, orgEntityId, isPrimary: true })
        .expect(201);
      await request(ctx.httpServer)
        .post('/api/v1/law-handlers')
        .set(withAuth(MANAGE))
        .send({ lawId: lawB, orgEntityId, isPrimary: true })
        .expect(201);

      const res = await request(ctx.httpServer)
        .get('/api/v1/law-handlers')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer).get('/api/v1/law-handlers').expect(401);
    });

    it('returns 403 without law-handlers.read', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/law-handlers')
        .set(withAuth(NO_PERMS))
        .expect(403);
    });
  });

  // SKIPPED — these describe blocks exercise routes that no longer exist
  // on the controller. PR #1273 ("de-engine remaining 5 entities") removed
  // the auto-generated entity-engine routes (`GET /<slug>/layout/list`,
  // `POST /<slug>/:id/clone`, `POST /<slug>/:id/restore`) when each
  // module switched from `EntityEngineModule.forEntity` to its own
  // hand-rolled controller. The tests pre-date that migration and now hit
  // 404 instead of the expected 401/403. Skipped pending user approval to
  // delete (per .claude/rules/no-deletes-without-approval). See PR #1298.
  describe.skip('GET /api/v1/law-handlers/layout/list', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.httpServer).get('/api/v1/law-handlers/layout/list').expect(401);
    });

    it('returns 403 without law-handlers.read', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/law-handlers/layout/list')
        .set(withAuth(NO_PERMS))
        .expect(403);
    });
  });

  describe('GET /api/v1/law-handlers/:id', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('returns 403 without law-handlers.read', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000')
        .set(withAuth(NO_PERMS))
        .expect(403);
    });
  });

  describe('PATCH /api/v1/law-handlers/:id', () => {
    it('updates a handler', async () => {
      const { lawId, orgEntityId } = await prereqs();
      const created = await request(ctx.httpServer)
        .post('/api/v1/law-handlers')
        .set(withAuth(MANAGE))
        .send({ lawId, orgEntityId, isPrimary: false })
        .expect(201);

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/law-handlers/${created.body.id}`)
        .set(withAuth(MANAGE))
        .send({ isPrimary: true })
        .expect(200);

      expect(res.body.isPrimary).toBe(true);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .patch('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000')
        .send({ isPrimary: true })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      await request(ctx.httpServer)
        .patch('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .send({ isPrimary: true })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/law-handlers/:id', () => {
    it('accepts the delete request', async () => {
      const { lawId, orgEntityId } = await prereqs();
      const created = await request(ctx.httpServer)
        .post('/api/v1/law-handlers')
        .set(withAuth(MANAGE))
        .send({ lawId, orgEntityId, isPrimary: true })
        .expect(201);

      await request(ctx.httpServer)
        .delete(`/api/v1/law-handlers/${created.body.id}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .delete('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      await request(ctx.httpServer)
        .delete('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(403);
    });
  });

  // SKIPPED — these describe blocks exercise routes that no longer exist
  // on the controller. PR #1273 ("de-engine remaining 5 entities") removed
  // the auto-generated entity-engine routes (`GET /<slug>/layout/list`,
  // `POST /<slug>/:id/clone`, `POST /<slug>/:id/restore`) when each
  // module switched from `EntityEngineModule.forEntity` to its own
  // hand-rolled controller. The tests pre-date that migration and now hit
  // 404 instead of the expected 401/403. Skipped pending user approval to
  // delete (per .claude/rules/no-deletes-without-approval). See PR #1298.
  describe.skip('POST /api/v1/law-handlers/:id/clone', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000/clone')
        .expect(401);
    });

    it('returns 403 without create permission', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000/clone')
        .set(withAuth(READ))
        .expect(403);
    });
  });

  // SKIPPED — these describe blocks exercise routes that no longer exist
  // on the controller. PR #1273 ("de-engine remaining 5 entities") removed
  // the auto-generated entity-engine routes (`GET /<slug>/layout/list`,
  // `POST /<slug>/:id/clone`, `POST /<slug>/:id/restore`) when each
  // module switched from `EntityEngineModule.forEntity` to its own
  // hand-rolled controller. The tests pre-date that migration and now hit
  // 404 instead of the expected 401/403. Skipped pending user approval to
  // delete (per .claude/rules/no-deletes-without-approval). See PR #1298.
  describe.skip('POST /api/v1/law-handlers/:id/restore', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000/restore')
        .expect(401);
    });

    it('returns 403 without update permission', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/law-handlers/00000000-0000-0000-0000-000000000000/restore')
        .set(withAuth(READ))
        .expect(403);
    });
  });
});
