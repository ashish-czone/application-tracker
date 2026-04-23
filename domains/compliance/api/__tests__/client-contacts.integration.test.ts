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
      clientId,
      name: unique('Contact'),
      isPrimary: false,
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
        .send({ clientId, name: 'Jane Doe', email: 'jane@example.com', isPrimary: true })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        clientId,
        name: 'Jane Doe',
        email: 'jane@example.com',
        isPrimary: true,
      });
    });

    it('rejects missing clientId', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .set(withAuth(MANAGE))
        .send({ name: 'Jane' })
        .expect(400);
    });

    it('rejects missing name', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .set(withAuth(MANAGE))
        .send({ clientId })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .send({ clientId, name: 'X' })
        .expect(401);
    });

    it('returns 403 with read-only permission', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .set(withAuth(READ))
        .send({ clientId, name: 'X' })
        .expect(403);
    });
  });

  describe('GET /api/v1/client-contacts', () => {
    it('lists contacts', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await createContactViaApi(clientId, { name: 'A' });
      await createContactViaApi(clientId, { name: 'B' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/client-contacts')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('PUT /api/v1/clients/:id/contacts/:contactId/primary', () => {
    it('flips which contact is primary atomically', async () => {
      const { id: clientId } = await createClient(ctx.db);
      const c1 = await createContactViaApi(clientId, { name: 'First', isPrimary: true });
      const c2 = await createContactViaApi(clientId, { name: 'Second', isPrimary: false });

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

      expect(demoted.body.isPrimary).toBe(false);
      expect(promoted.body.isPrimary).toBe(true);
    });

    it('returns 404 when contact does not belong to the client', async () => {
      const { id: clientA } = await createClient(ctx.db);
      const { id: clientB } = await createClient(ctx.db);
      const contact = await createContactViaApi(clientB, { name: 'Foreign' });

      await request(ctx.httpServer)
        .put(`/api/v1/clients/${clientA}/contacts/${contact.id}/primary`)
        .set(withAuth(MANAGE))
        .expect(404);
    });

    it('returns 403 without update permission', async () => {
      const { id: clientId } = await createClient(ctx.db);
      const contact = await createContactViaApi(clientId, { name: 'X' });
      await request(ctx.httpServer)
        .put(`/api/v1/clients/${clientId}/contacts/${contact.id}/primary`)
        .set(withAuth(READ))
        .expect(403);
    });
  });

  describe('schema: one-primary-per-client invariant', () => {
    it('rejects creating a second primary contact for the same client', async () => {
      const { id: clientId } = await createClient(ctx.db);
      await createContactViaApi(clientId, { name: 'First', isPrimary: true });
      // The partial unique index rejects at the SQL layer. The entity-engine
      // generic controller surfaces it as a 500 today (no mapping for
      // constraint-violation → 409) — the test pins current behavior so a
      // future mapper change becomes an explicit update here.
      const res = await request(ctx.httpServer)
        .post('/api/v1/client-contacts')
        .set(withAuth(MANAGE))
        .send({ clientId, name: 'Second', isPrimary: true });
      expect([409, 500]).toContain(res.status);
    });
  });
});
