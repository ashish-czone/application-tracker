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
  });
});
