import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { DocumentTemplatesModule } from '../../document-templates.module';
import { DOCUMENT_TEMPLATES_PERMISSIONS } from '../../permissions';

const READ = [DOCUMENT_TEMPLATES_PERMISSIONS.READ];
const CREATE = [DOCUMENT_TEMPLATES_PERMISSIONS.CREATE];
const UPDATE = [DOCUMENT_TEMPLATES_PERMISSIONS.UPDATE];
const DELETE = [DOCUMENT_TEMPLATES_PERMISSIONS.DELETE];
const ALL = [...READ, ...CREATE, ...UPDATE, ...DELETE];

describe('DocumentTemplatesController (integration)', () => {
  let ctx: PackageTestApp;
  let testUserId: string;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [DocumentTemplatesModule.register()],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
    testUserId = randomUUID();
    await ctx.db.execute(
      sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at) VALUES (${testUserId}, ${`doctest-${Date.now()}@example.com`}, ${'Test'}, ${'User'}, ${'admin'}, NOW())`,
    );
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createTemplate(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: `Offer Letter ${seq}`,
      category: 'offer-letters',
      htmlBody: '<h1>Offer for {{candidate.name}}</h1>',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/document-templates')
      .set(withAuth(ALL, { userId: testUserId }))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── CRUD ────────────────────────────────────────────────────

  describe('POST /api/v1/document-templates', () => {
    it('should create a template', async () => {
      const template = await createTemplate({
        name: 'Employment Agreement',
        category: 'contracts',
        subject: 'Your Employment Agreement',
        htmlBody: '<p>Dear {{candidate.name}},</p>',
      });

      expect(template).toMatchObject({
        id: expect.any(String),
        name: 'Employment Agreement',
        category: 'contracts',
        subject: 'Your Employment Agreement',
      });
    });

    it('should reject missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/document-templates')
        .set(withAuth(ALL, { userId: testUserId }))
        .send({ category: 'test', htmlBody: '<p>Hello</p>' })
        .expect(400);
    });

    it('should reject missing category', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/document-templates')
        .set(withAuth(ALL, { userId: testUserId }))
        .send({ name: 'Test', htmlBody: '<p>Hello</p>' })
        .expect(400);
    });

    it('should reject missing htmlBody', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/document-templates')
        .set(withAuth(ALL, { userId: testUserId }))
        .send({ name: 'Test', category: 'test' })
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/document-templates')
        .set(withAuth(ALL, { userId: testUserId }))
        .send({ name: 'Test', category: 'test', htmlBody: '<p>Hi</p>', hackField: 'injected' })
        .expect(400);
    });
  });

  describe('GET /api/v1/document-templates', () => {
    it('should list all templates', async () => {
      await createTemplate({ name: 'Alpha', category: 'cat-a' });
      await createTemplate({ name: 'Beta', category: 'cat-b' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/document-templates')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by category', async () => {
      await createTemplate({ name: 'Offer A', category: 'offers' });
      await createTemplate({ name: 'Contract B', category: 'contracts' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/document-templates?category=offers')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Offer A');
    });

    it('should return empty array when no templates', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/document-templates')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/v1/document-templates/categories', () => {
    it('should list registered categories', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/document-templates/categories')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/document-templates/:id', () => {
    it('should return a template by ID', async () => {
      const template = await createTemplate({ name: 'Lookup Template' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/document-templates/${template.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: template.id, name: 'Lookup Template' });
    });

    it('should return 404 for non-existent ID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/document-templates/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/document-templates/not-a-uuid')
        .set(withAuth(READ))
        .expect(400);
    });
  });

  describe('PATCH /api/v1/document-templates/:id', () => {
    it('should update a template name', async () => {
      const template = await createTemplate();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/document-templates/${template.id}`)
        .set(withAuth([...READ, ...UPDATE]))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('should update template body', async () => {
      const template = await createTemplate();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/document-templates/${template.id}`)
        .set(withAuth([...READ, ...UPDATE]))
        .send({ htmlBody: '<p>Updated body</p>' })
        .expect(200);

      expect(res.body.htmlBody).toBe('<p>Updated body</p>');
    });
  });

  describe('DELETE /api/v1/document-templates/:id', () => {
    it('should delete a template', async () => {
      const template = await createTemplate();

      await request(ctx.httpServer)
        .delete(`/api/v1/document-templates/${template.id}`)
        .set(withAuth([...READ, ...DELETE]))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/document-templates/${template.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/document-templates')
        .expect(401);
    });

    it('should return 403 with read-only on create endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/document-templates')
        .set(withAuth(READ))
        .send({ name: 'Test', category: 'test', htmlBody: '<p>Hi</p>' })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/document-templates')
        .set(withAuth(['*']))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
