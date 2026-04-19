import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { AuditModule } from '@packages/audit';
import { EvaluationsModule } from '../../evaluations.module';
import { EVALUATIONS_PERMISSIONS } from '../../permissions';

const READ = [EVALUATIONS_PERMISSIONS.TEMPLATES_READ];
const MANAGE = [...READ, EVALUATIONS_PERMISSIONS.TEMPLATES_MANAGE];

describe('EvaluationTemplatesController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [AuditModule, EvaluationsModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createEvalTemplate(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: `Technical Interview ${seq}`,
      slug: `technical-interview-${Date.now()}-${seq}`,
      entityType: 'interviews',
      criteria: [
        { name: 'Problem Solving', description: 'Ability to break down complex problems' },
        { name: 'Communication', description: 'Clear and effective communication' },
      ],
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/evaluation-templates')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── CRUD ────────────────────────────────────────────────────

  describe('POST /api/v1/evaluation-templates', () => {
    it('should create an evaluation template', async () => {
      const template = await createEvalTemplate({
        name: 'Culture Fit Scorecard',
        slug: 'culture-fit',
        entityType: 'interviews',
      });

      expect(template).toMatchObject({
        id: expect.any(String),
        name: 'Culture Fit Scorecard',
        slug: 'culture-fit',
        entityType: 'interviews',
      });
    });

    it('should reject missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/evaluation-templates')
        .set(withAuth(MANAGE))
        .send({ slug: 'test', entityType: 'interviews', criteria: [] })
        .expect(400);
    });

    it('should reject missing slug', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/evaluation-templates')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', entityType: 'interviews', criteria: [] })
        .expect(400);
    });

    it('should reject invalid slug format', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/evaluation-templates')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', slug: 'Invalid Slug', entityType: 'interviews', criteria: [] })
        .expect(400);
    });

    it('should reject missing criteria', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/evaluation-templates')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', slug: 'test', entityType: 'interviews' })
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/evaluation-templates')
        .set(withAuth(MANAGE))
        .send({
          name: 'Test',
          slug: 'test',
          entityType: 'interviews',
          criteria: [],
          hackField: 'injected',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/evaluation-templates', () => {
    it('should list evaluation templates', async () => {
      await createEvalTemplate({ name: 'Alpha', slug: 'alpha' });
      await createEvalTemplate({ name: 'Beta', slug: 'beta' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/evaluation-templates')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({
        page: 1,
        total: 2,
      });
    });

    it('should filter by entityType', async () => {
      await createEvalTemplate({ name: 'Interview', slug: 'interview', entityType: 'interviews' });
      await createEvalTemplate({ name: 'Review', slug: 'review', entityType: 'reviews' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/evaluation-templates?entityType=interviews')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Interview');
    });

    it('should paginate', async () => {
      await createEvalTemplate({ name: 'Alpha', slug: 'alpha' });
      await createEvalTemplate({ name: 'Beta', slug: 'beta' });
      await createEvalTemplate({ name: 'Gamma', slug: 'gamma' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/evaluation-templates?page=1&limit=2')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(3);
    });
  });

  describe('GET /api/v1/evaluation-templates/:id', () => {
    it('should return a template by ID', async () => {
      const template = await createEvalTemplate({ name: 'Lookup Test', slug: 'lookup-test' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/evaluation-templates/${template.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: template.id, name: 'Lookup Test' });
    });

    it('should return 404 for non-existent ID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/evaluation-templates/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/evaluation-templates/:id', () => {
    it('should update a template name', async () => {
      const template = await createEvalTemplate();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/evaluation-templates/${template.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('should update criteria', async () => {
      const template = await createEvalTemplate();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/evaluation-templates/${template.id}`)
        .set(withAuth(MANAGE))
        .send({
          criteria: [{ name: 'New Criterion', description: 'A new criterion' }],
        })
        .expect(200);

      expect(res.body.criteria).toHaveLength(1);
      expect(res.body.criteria[0].name).toBe('New Criterion');
    });

    it('should toggle isActive', async () => {
      const template = await createEvalTemplate();

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/evaluation-templates/${template.id}`)
        .set(withAuth(MANAGE))
        .send({ isActive: false })
        .expect(200);

      expect(res.body.isActive).toBe(false);
    });
  });

  describe('DELETE /api/v1/evaluation-templates/:id', () => {
    it('should delete a template', async () => {
      const template = await createEvalTemplate();

      await request(ctx.httpServer)
        .delete(`/api/v1/evaluation-templates/${template.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/evaluation-templates/${template.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/evaluation-templates')
        .expect(401);
    });

    it('should return 403 with read-only on create endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/evaluation-templates')
        .set(withAuth(READ))
        .send({ name: 'Test', slug: 'test', entityType: 'interviews', criteria: [] })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/evaluation-templates')
        .set(withAuth(['*']))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
