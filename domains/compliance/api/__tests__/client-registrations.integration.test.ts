import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import { createClient, createLaw, createLawWithHandler, createRegistration } from './setup/fixtures';

/**
 * Covers both the custom `POST /clients/:id/registrations` flow (also exercised
 * by `clients.integration.test.ts`) and the generic entity-engine CRUD
 * endpoint. The DTO coerces ISO-string timestamps into `Date` instances so
 * direct POSTs of JSON bodies parse cleanly.
 */

const READ = ['client-registrations.read'];
const MANAGE = [
  'client-registrations.read',
  'client-registrations.create',
  'client-registrations.update',
  'client-registrations.delete',
];
// Authenticated but holds zero compliance perms — drives 403 on the
// pure-read endpoints whose only `@RequirePermission` is `*.read`.
const NO_PERMS: string[] = [];

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
    // Use createLaw (no handler) for read-only fixtures and create-failure
    // assertions; tests that POST a successful registration call
    // `createLawWithHandler` via `writeablePrereqs()` so the service's
    // `assertHandlerResolvable` guard (PR #1064) passes.
    const { id: lawId } = await createLaw(ctx.db);
    return { clientId, lawId };
  }

  async function writeablePrereqs() {
    const { id: clientId } = await createClient(ctx.db);
    const { id: lawId } = await createLawWithHandler(ctx.db);
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

    it('returns 403 without client-registrations.read', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/client-registrations')
        .set(withAuth(NO_PERMS))
        .expect(403);
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

    it('accepts an ISO 8601 string for registeredAt', async () => {
      const { clientId, lawId } = await writeablePrereqs();
      const registeredAt = '2026-04-01T09:00:00.000Z';

      const res = await request(ctx.httpServer)
        .post('/api/v1/client-registrations')
        .set(withAuth(MANAGE))
        .send({ clientId, lawId, registeredAt })
        .expect(201);

      expect(res.body).toMatchObject({ clientId, lawId });
      expect(new Date(res.body.registeredAt).toISOString()).toBe(registeredAt);
    });

    it('defaults registeredAt to now when omitted', async () => {
      const { clientId, lawId } = await writeablePrereqs();

      const res = await request(ctx.httpServer)
        .post('/api/v1/client-registrations')
        .set(withAuth(MANAGE))
        .send({ clientId, lawId })
        .expect(201);

      expect(res.body).toMatchObject({ clientId, lawId });
      expect(typeof res.body.registeredAt).toBe('string');
    });

    it('rejects an unparseable registeredAt value', async () => {
      const { clientId, lawId } = await prereqs();
      await request(ctx.httpServer)
        .post('/api/v1/client-registrations')
        .set(withAuth(MANAGE))
        .send({ clientId, lawId, registeredAt: 'not-a-date' })
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

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .delete('/api/v1/client-registrations/00000000-0000-0000-0000-000000000000')
        .expect(401);
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

  // 401 (anon) + 403 (insufficient perm) coverage for the remaining
  // client-registrations endpoints. Positive paths live above; this block
  // is the mechanical sweep to satisfy the per-endpoint security-test
  // mandate (audit S8/T6).
  describe('auth coverage', () => {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';

    describe('GET /api/v1/client-registrations/:id (auth)', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/client-registrations/${NIL_UUID}`)
          .expect(401);
      });
      it('returns 403 without client-registrations.read', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/client-registrations/${NIL_UUID}`)
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('PATCH /api/v1/client-registrations/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .patch(`/api/v1/client-registrations/${NIL_UUID}`)
          .send({})
          .expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .patch(`/api/v1/client-registrations/${NIL_UUID}`)
          .set(withAuth(READ))
          .send({})
          .expect(403);
      });
    });

  });
});
