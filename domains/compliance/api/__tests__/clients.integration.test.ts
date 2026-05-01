import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import { createLaw, createLawWithHandler } from './setup/fixtures';

const READ = ['clients.read'];
const MANAGE = [
  'clients.read',
  'clients.create',
  'clients.update',
  'clients.delete',
  'client-contacts.create',
  'client-contacts.update',
  'client-registrations.create',
];
// Authenticated but holds zero compliance perms — drives 403 on the
// pure-read endpoints whose only `@RequirePermission` is `*.read`.
const NO_PERMS: string[] = [];
// Holds clients.* perms but lacks `client-registrations.delete` — drives
// 403 on the deactivation-preview / deactivate endpoints, which gate on
// the registrations perm even though they live under /clients/:id/.
const CLIENTS_NO_REGISTRATIONS_DELETE = MANAGE;

describe('Clients (integration)', () => {
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

  async function createClient(overrides: Record<string, unknown> = {}) {
    const body = {
      name: unique('Client'),
      legalName: 'Test Client Pvt Ltd',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/clients')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  describe('POST /api/v1/clients (generic entity route)', () => {
    it('creates a client', async () => {
      const name = unique('Acme');
      const res = await request(ctx.httpServer)
        .post('/api/v1/clients')
        .set(withAuth(MANAGE))
        .send({ name, legalName: 'Acme Corp' })
        .expect(201);

      expect(res.body).toMatchObject({ id: expect.any(String), name, legalName: 'Acme Corp' });
    });

    it('rejects missing legalName', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/clients')
        .set(withAuth(MANAGE))
        .send({ name: unique('X') })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/clients')
        .send({ name: 'X', legalName: 'Y' })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/clients')
        .set(withAuth(READ))
        .send({ name: 'X', legalName: 'Y' })
        .expect(403);
    });
  });

  describe('POST /api/v1/clients/with-contacts', () => {
    it('creates a client with contacts atomically', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/clients/with-contacts')
        .set(withAuth(MANAGE))
        .send({
          client: { name: unique('Client'), legalName: 'With Contacts Ltd' },
          contacts: [
            { fullName: 'Jane Doe', primaryEmail: 'jane@example.com', complianceIsPrimary: true },
          ],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        client: { id: expect.any(String), legalName: 'With Contacts Ltd' },
        contacts: expect.any(Array),
      });
      expect(res.body.contacts).toHaveLength(1);
    });

    it('requires at least one contact', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/clients/with-contacts')
        .set(withAuth(MANAGE))
        .send({
          client: { name: unique('X'), legalName: 'X' },
          contacts: [],
        })
        .expect(400);
    });

    it('returns 403 without create permission', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/clients/with-contacts')
        .set(withAuth(READ))
        .send({
          client: { name: unique('X'), legalName: 'X' },
          contacts: [{ fullName: 'Jane' }],
        })
        .expect(403);
    });
  });

  describe('POST /api/v1/clients/:id/registrations', () => {
    it('batch-registers a client against laws by code', async () => {
      const client = await createClient();
      // Both laws need a default handler — POST /clients/:id/registrations
      // calls the same `assertHandlerResolvable` guard as the generic CRUD
      // endpoint (PR #1064).
      const { code: code1 } = await createLawWithHandler(ctx.db, { code: unique('LAW-A') });
      const { code: code2 } = await createLawWithHandler(ctx.db, { code: unique('LAW-B') });

      const res = await request(ctx.httpServer)
        .post(`/api/v1/clients/${client.id}/registrations`)
        .set(withAuth(MANAGE))
        .send({ lawCodes: [code1, code2] })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it('rejects empty lawCodes', async () => {
      const client = await createClient();
      await request(ctx.httpServer)
        .post(`/api/v1/clients/${client.id}/registrations`)
        .set(withAuth(MANAGE))
        .send({ lawCodes: [] })
        .expect(400);
    });

    it('returns 403 without client-registrations.create permission', async () => {
      const client = await createClient();
      await request(ctx.httpServer)
        .post(`/api/v1/clients/${client.id}/registrations`)
        .set(withAuth(READ))
        .send({ lawCodes: ['X'] })
        .expect(403);
    });
  });

  describe('workflow: status transition', () => {
    it('onboarding → active is blocked without a primary contact', async () => {
      const client = await createClient();

      const res = await request(ctx.httpServer)
        .post(`/api/v1/clients/${client.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'active' });

      // Guard rejects — 400 or 422 depending on guard framing.
      expect([400, 403, 422]).toContain(res.status);
    });

    it('allows onboarding → active once a primary contact exists', async () => {
      // Create through the with-contacts endpoint so the primary-contact
      // invariant is satisfied in a single transaction.
      const res = await request(ctx.httpServer)
        .post('/api/v1/clients/with-contacts')
        .set(withAuth(MANAGE))
        .send({
          client: { name: unique('Ready'), legalName: 'Ready Ltd' },
          contacts: [{ fullName: 'Primary', complianceIsPrimary: true }],
        })
        .expect(201);
      const clientId = res.body.client.id;

      await request(ctx.httpServer)
        .post(`/api/v1/clients/${clientId}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(201);
    });

    it('active → dormant is rejected when actor lacks clients.dormantise', async () => {
      // Bring the client to `active` first using the broader MANAGE token.
      const created = await request(ctx.httpServer)
        .post('/api/v1/clients/with-contacts')
        .set(withAuth(MANAGE))
        .send({
          client: { name: unique('GateProbe'), legalName: 'Gate Probe Ltd' },
          contacts: [{ fullName: 'Primary', complianceIsPrimary: true }],
        })
        .expect(201);
      const clientId = created.body.client.id;
      await request(ctx.httpServer)
        .post(`/api/v1/clients/${clientId}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(201);

      // MANAGE deliberately omits `clients.dormantise` — same actor that
      // could update the client cannot trigger the destructive cascade.
      const res = await request(ctx.httpServer)
        .post(`/api/v1/clients/${clientId}/transition`)
        .set(withAuth(MANAGE))
        .send({
          fieldKey: 'status',
          to: 'dormant',
          reason: 'Ceased operations',
          comment: 'No longer trading',
        });
      expect([400, 403]).toContain(res.status);
    });

    it('active → dormant succeeds when actor holds clients.dormantise', async () => {
      const created = await request(ctx.httpServer)
        .post('/api/v1/clients/with-contacts')
        .set(withAuth(MANAGE))
        .send({
          client: { name: unique('CanDormant'), legalName: 'Can Dormant Ltd' },
          contacts: [{ fullName: 'Primary', complianceIsPrimary: true }],
        })
        .expect(201);
      const clientId = created.body.client.id;
      await request(ctx.httpServer)
        .post(`/api/v1/clients/${clientId}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(201);

      await request(ctx.httpServer)
        .post(`/api/v1/clients/${clientId}/transition`)
        .set(withAuth([...MANAGE, 'clients.dormantise']))
        .send({
          fieldKey: 'status',
          to: 'dormant',
          reason: 'Ceased operations',
          comment: 'No longer trading',
        })
        .expect(201);
    });
  });

  // 401 (anon) + 403 (insufficient perm) coverage for every endpoint on
  // the clients controller. Positive paths live above; this block is a
  // mechanical sweep to satisfy the per-endpoint security-test mandate
  // (audit S8/T6, PROMPT-API.md).
  describe('auth coverage', () => {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';

    describe('GET /api/v1/clients/layout/list', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/clients/layout/list').expect(401);
      });
      it('returns 403 without clients.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/clients/layout/list')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/clients (list)', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/clients').expect(401);
      });
      it('returns 403 without clients.read', async () => {
        await request(ctx.httpServer).get('/api/v1/clients').set(withAuth(NO_PERMS)).expect(403);
      });
    });

    describe('GET /api/v1/clients/summary', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/clients/summary').expect(401);
      });
      it('returns 403 without clients.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/clients/summary')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/clients/handler-options', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/clients/handler-options').expect(401);
      });
      it('returns 403 without clients.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/clients/handler-options')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/clients/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get(`/api/v1/clients/${NIL_UUID}`).expect(401);
      });
      it('returns 403 without clients.read', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/clients/${NIL_UUID}`)
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('PATCH /api/v1/clients/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).patch(`/api/v1/clients/${NIL_UUID}`).send({}).expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .patch(`/api/v1/clients/${NIL_UUID}`)
          .set(withAuth(READ))
          .send({})
          .expect(403);
      });
    });

    describe('DELETE /api/v1/clients/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).delete(`/api/v1/clients/${NIL_UUID}`).expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .delete(`/api/v1/clients/${NIL_UUID}`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    describe('POST /api/v1/clients/:id/transition (auth)', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/clients/${NIL_UUID}/transition`)
          .send({ fieldKey: 'status', to: 'active' })
          .expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/clients/${NIL_UUID}/transition`)
          .set(withAuth(READ))
          .send({ fieldKey: 'status', to: 'active' })
          .expect(403);
      });
    });

    describe('GET /api/v1/clients/:id/transition-preview', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/clients/${NIL_UUID}/transition-preview`)
          .expect(401);
      });
      it('returns 403 without clients.update', async () => {
        // The preview endpoint deliberately reuses the destructive perm
        // (`clients.update`) so a read-only actor cannot probe the
        // transition graph; covered by audit finding S11.
        await request(ctx.httpServer)
          .get(`/api/v1/clients/${NIL_UUID}/transition-preview`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    describe('POST /api/v1/clients/:id/clone', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).post(`/api/v1/clients/${NIL_UUID}/clone`).expect(401);
      });
      it('returns 403 without clients.create', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/clients/${NIL_UUID}/clone`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    describe('POST /api/v1/clients/:id/restore', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).post(`/api/v1/clients/${NIL_UUID}/restore`).expect(401);
      });
      it('returns 403 without clients.update', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/clients/${NIL_UUID}/restore`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    describe('POST /api/v1/clients/with-contacts (401)', () => {
      // The 403 path is already covered above ("returns 403 without create
      // permission") — this block fills in the missing 401 pair.
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post('/api/v1/clients/with-contacts')
          .send({ client: { name: 'X', legalName: 'Y' }, contacts: [] })
          .expect(401);
      });
    });

    describe('PUT /api/v1/clients/:id/contacts/:contactId/primary (401)', () => {
      // 403 path covered by client-contacts.integration.test.ts.
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .put(`/api/v1/clients/${NIL_UUID}/contacts/${NIL_UUID}/primary`)
          .expect(401);
      });
    });

    describe('POST /api/v1/clients/:id/registrations (401)', () => {
      // 403 path covered above ("returns 403 without client-registrations.create
      // permission") — this block fills in the missing 401 pair.
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/clients/${NIL_UUID}/registrations`)
          .send({ lawCodes: ['X'] })
          .expect(401);
      });
    });

    describe('GET /api/v1/clients/:id/registrations/:lawId/deactivation-preview', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/clients/${NIL_UUID}/registrations/${NIL_UUID}/deactivation-preview`)
          .expect(401);
      });
      it('returns 403 without client-registrations.delete', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/clients/${NIL_UUID}/registrations/${NIL_UUID}/deactivation-preview`)
          .set(withAuth(CLIENTS_NO_REGISTRATIONS_DELETE))
          .expect(403);
      });
    });

    describe('POST /api/v1/clients/:id/registrations/:lawId/deactivate', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/clients/${NIL_UUID}/registrations/${NIL_UUID}/deactivate`)
          .send({})
          .expect(401);
      });
      it('returns 403 without client-registrations.delete', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/clients/${NIL_UUID}/registrations/${NIL_UUID}/deactivate`)
          .set(withAuth(CLIENTS_NO_REGISTRATIONS_DELETE))
          .send({})
          .expect(403);
      });
    });
  });
});
