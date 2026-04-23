import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';

const READ = ['organization.read'];
const MANAGE = [
  'organization.read',
  'organization.create',
  'organization.update',
  'organization.delete',
];

describe('Organizations singleton (integration)', () => {
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

  describe('POST /api/v1/organization', () => {
    it('creates the singleton organization', async () => {
      const res = await request(ctx.httpServer)
        .post('/api/v1/organization')
        .set(withAuth(MANAGE))
        .send({ name: 'Acme HQ', legalName: 'Acme Corporation' })
        .expect(201);

      expect(res.body).toMatchObject({ id: expect.any(String), name: 'Acme HQ' });
    });

    it('rejects a second row (singleton enforcement)', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/organization')
        .set(withAuth(MANAGE))
        .send({ name: 'First' })
        .expect(201);

      await request(ctx.httpServer)
        .post('/api/v1/organization')
        .set(withAuth(MANAGE))
        .send({ name: 'Second' })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/organization')
        .send({ name: 'X' })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/organization')
        .set(withAuth(READ))
        .send({ name: 'X' })
        .expect(403);
    });
  });

  describe('PATCH /api/v1/organization/:id', () => {
    it('updates the singleton', async () => {
      const created = await request(ctx.httpServer)
        .post('/api/v1/organization')
        .set(withAuth(MANAGE))
        .send({ name: 'Old Name' })
        .expect(201);

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/organization/${created.body.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
    });
  });

  describe('DELETE /api/v1/organization/:id', () => {
    it('rejects deletion of the organization', async () => {
      const created = await request(ctx.httpServer)
        .post('/api/v1/organization')
        .set(withAuth(MANAGE))
        .send({ name: 'Undeletable' })
        .expect(201);

      // beforeDelete hook throws BadRequestException with a fixed message.
      await request(ctx.httpServer)
        .delete(`/api/v1/organization/${created.body.id}`)
        .set(withAuth(MANAGE))
        .expect(400);
    });
  });

  describe('GET /api/v1/organization/:id', () => {
    it('returns the singleton', async () => {
      const created = await request(ctx.httpServer)
        .post('/api/v1/organization')
        .set(withAuth(MANAGE))
        .send({ name: 'Acme' })
        .expect(201);

      const res = await request(ctx.httpServer)
        .get(`/api/v1/organization/${created.body.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.id).toBe(created.body.id);
    });
  });
});
