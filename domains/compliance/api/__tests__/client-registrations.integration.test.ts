import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import { createClient, createLaw, createRegistration } from './setup/fixtures';

/**
 * Client-registration POSTs are covered by `clients.integration.test.ts`
 * via the custom `POST /clients/:id/registrations` endpoint. The generic
 * entity-engine CRUD endpoint can't create registrations today because the
 * platform doesn't convert ISO-string datetime payloads into Date instances
 * before handing them to drizzle (schema uses `mode: 'date'`), so a direct
 * POST to /api/v1/client-registrations with `registeredAt` fails with
 * `value.toISOString is not a function`, and omitting it trips the
 * required-field validator.
 *
 * This file pins the read/auth surface and uses the fixtures helper to seed
 * rows directly — exercising what the production read paths do.
 */

const READ = ['client-registrations.read'];
const MANAGE = [
  'client-registrations.read',
  'client-registrations.create',
  'client-registrations.update',
  'client-registrations.delete',
];

describe('Client Registrations (integration)', () => {
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
    const { id: clientId } = await createClient(ctx.db);
    const { id: lawId } = await createLaw(ctx.db);
    return { clientId, lawId };
  }

  describe('GET /api/v1/client-registrations', () => {
    // List cannot be exercised against the entity-engine's generic endpoint
    // because the config's `defaultSort: '-registeredAt'` doesn't resolve to
    // a sortable column (the dash-prefix isn't stripped, and no fields are
    // marked `sortable: true` in client-registrations.config), producing an
    // empty ORDER BY that Postgres rejects. Passing a different `?sort=` query
    // param has the same outcome because the column isn't registered as
    // sortable. Skipping until the platform either strips the prefix or
    // auto-makes defaultSort sortable.

    it('returns 401 without auth on list', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/client-registrations')
        .expect(401);
    });
  });

  describe('GET /api/v1/client-registrations/:id', () => {
    it('returns a registration by id', async () => {
      const { clientId, lawId } = await prereqs();
      const { id } = await createRegistration(ctx.db, clientId, lawId);

      const res = await request(ctx.httpServer)
        .get(`/api/v1/client-registrations/${id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id, clientId, lawId });
    });

    it('returns 404 for unknown id', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/client-registrations/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('POST /api/v1/client-registrations (generic CRUD)', () => {
    it('returns 401 without auth', async () => {
      const { clientId, lawId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/client-registrations')
        .send({ clientId, lawId })
        .expect(401);
    });

    it('returns 403 with read-only permission', async () => {
      const { clientId, lawId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/client-registrations')
        .set(withAuth(READ))
        .send({ clientId, lawId })
        .expect(403);
    });

    it('rejects missing clientId', async () => {
      const { lawId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/client-registrations')
        .set(withAuth(MANAGE))
        .send({ lawId })
        .expect(400);
    });

    it('rejects missing lawId', async () => {
      const { clientId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/client-registrations')
        .set(withAuth(MANAGE))
        .send({ clientId })
        .expect(400);
    });
  });

  describe('DELETE /api/v1/client-registrations/:id', () => {
    it('accepts the delete request', async () => {
      const { clientId, lawId } = await prereqs();
      const { id } = await createRegistration(ctx.db, clientId, lawId);
      await request(ctx.httpServer)
        .delete(`/api/v1/client-registrations/${id}`)
        .set(withAuth(MANAGE))
        .expect(204);
    });

    it('returns 403 without delete permission', async () => {
      const { clientId, lawId } = await prereqs();
      const { id } = await createRegistration(ctx.db, clientId, lawId);
      await request(ctx.httpServer)
        .delete(`/api/v1/client-registrations/${id}`)
        .set(withAuth(READ))
        .expect(403);
    });
  });
});
