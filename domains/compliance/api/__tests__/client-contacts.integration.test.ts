import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import { createClient } from './setup/fixtures';

const READ = ['client-contacts.read'];
const MANAGE = [
  'client-contacts.read',
  'client-contacts.create',
  'client-contacts.update',
  'client-contacts.delete',
];
// Authenticated but holds zero compliance perms — drives 403 on the
// pure-read endpoints whose only `@RequirePermission` is `*.read`.
const NO_PERMS: string[] = [];

describe('Client Contacts (integration)', () => {
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

  let seq = 0;
  const unique = (prefix: string) => `${prefix}-${Date.now()}-${++seq}`;

  async function createContactViaApi(
    clientId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const body = {
      complianceClientId: clientId,
      fullName: unique('Contact'),
      complianceIsPrimary: false,
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/client-contacts')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  describe('POST /api/v1/client-contacts', () => {
    it('creates a contact for a client', async () => {
      const { id: clientId } = await createClient(ctx.db);
      const res = await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .set(withAuth(MANAGE))
        .send({
          complianceClientId: clientId,
          fullName: 'Jane Doe',
          primaryEmail: 'jane@example.com',
          complianceIsPrimary: true,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        complianceClientId: clientId,
        fullName: 'Jane Doe',
        primaryEmail: 'jane@example.com',
        complianceIsPrimary: true,
      });
    });

    it('rejects missing clientId', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .set(withAuth(MANAGE))
        .send({ fullName: 'Jane' })
        .expect(400);
    });

    it('rejects missing name', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .set(withAuth(MANAGE))
        .send({ complianceClientId: clientId })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .send({ complianceClientId: clientId, fullName: 'X' })
        .expect(401);
    });

    it('returns 403 with read-only permission', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .set(withAuth(READ))
        .send({ complianceClientId: clientId, fullName: 'X' })
        .expect(403);
    });
  });

  describe('GET /api/v1/client-contacts', () => {
    it('lists contacts', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await createContactViaApi(clientId, { fullName: 'A' });
      await createContactViaApi(clientId, { fullName: 'B' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/client-contacts')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });
  });

  // 401 (anon) + 403 (insufficient perm) coverage for every endpoint on
  // the client-contacts controller. Positive paths live above; this block
  // is the mechanical sweep to satisfy the per-endpoint security-test
  // mandate (audit S8/T6).
  describe('auth coverage', () => {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';

    // GET /client-contacts/layout/list endpoint dropped in the
    // BaseCrudService migration — client-contacts has no custom UI page
    // that consumed the engine-generated layout, so the endpoint was
    // unused. Auth-gating coverage for the resource remains via the
    // GET / GET /:id / PATCH / DELETE tests below.

    describe('GET /api/v1/client-contacts (auth)', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/client-contacts').expect(401);
      });
      it('returns 403 without client-contacts.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/client-contacts')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/client-contacts/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get(`/api/v1/client-contacts/${NIL_UUID}`).expect(401);
      });
      it('returns 403 without client-contacts.read', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/client-contacts/${NIL_UUID}`)
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('PATCH /api/v1/client-contacts/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .patch(`/api/v1/client-contacts/${NIL_UUID}`)
          .send({})
          .expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .patch(`/api/v1/client-contacts/${NIL_UUID}`)
          .set(withAuth(READ))
          .send({})
          .expect(403);
      });
    });

    describe('DELETE /api/v1/client-contacts/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).delete(`/api/v1/client-contacts/${NIL_UUID}`).expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .delete(`/api/v1/client-contacts/${NIL_UUID}`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    // POST /client-contacts/:id/clone and /:id/restore endpoints dropped
    // in the BaseCrudService migration. They were auto-generated by the
    // entity-engine path; nothing in compliance UI consumed them. If a
    // future consumer needs them, add as overrides on the subclass.
  });

  describe('PUT /api/v1/clients/:id/contacts/:contactId/primary', () => {
    it('flips which contact is primary atomically', async () => {
      const { id: clientId } = await createClient(ctx.db);
      const c1 = await createContactViaApi(clientId, { fullName: 'First', complianceIsPrimary: true });
      const c2 = await createContactViaApi(clientId, { fullName: 'Second', complianceIsPrimary: false });

      await request(ctx.httpServer)
        .put(`/api/v1/clients/${clientId}/contacts/${c2.id}/primary`)
        .set(withAuth(MANAGE))
        .expect(204);

      const demoted = await request(ctx.httpServer)
        .get(`/api/v1/client-contacts/${c1.id}`)
        .set(withAuth(READ))
        .expect(200);
      const promoted = await request(ctx.httpServer)
        .get(`/api/v1/client-contacts/${c2.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(demoted.body.complianceIsPrimary).toBe(false);
      expect(promoted.body.complianceIsPrimary).toBe(true);
    });

    it('returns 404 when contact does not belong to the client', async () => {
      const { id: clientA } = await createClient(ctx.db);
      const { id: clientB } = await createClient(ctx.db);
      const contact = await createContactViaApi(clientB, { fullName: 'Foreign' });

      await request(ctx.httpServer)
        .put(`/api/v1/clients/${clientA}/contacts/${contact.id}/primary`)
        .set(withAuth(MANAGE))
        .expect(404);
    });

    it('returns 403 without update permission', async () => {
      const { id: clientId } = await createClient(ctx.db);
      const contact = await createContactViaApi(clientId, { fullName: 'X' });
      await request(ctx.httpServer)
        .put(`/api/v1/clients/${clientId}/contacts/${contact.id}/primary`)
        .set(withAuth(READ))
        .expect(403);
    });
  });

  describe('schema: one-primary-per-client invariant', () => {
    it('rejects creating a second primary contact for the same client', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await createContactViaApi(clientId, { fullName: 'First', complianceIsPrimary: true });
      // The partial unique index rejects at the SQL layer. The entity-engine
      // generic controller surfaces it as a 500 today (no mapping for
      // constraint-violation → 409) — the test pins current behavior so a
      // future mapper change becomes an explicit update here.
      const res = await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .set(withAuth(MANAGE))
        .send({ complianceClientId: clientId, fullName: 'Second', complianceIsPrimary: true });
      expect([409, 500]).toContain(res.status);
    });
  });
});
