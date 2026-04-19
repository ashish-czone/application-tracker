import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { AuditModule } from '@packages/audit';
import { EvaluationsModule } from '../../evaluations.module';
import { EVALUATIONS_PERMISSIONS } from '../../permissions';

const TEMPLATE_PERMS = [EVALUATIONS_PERMISSIONS.TEMPLATES_READ, EVALUATIONS_PERMISSIONS.TEMPLATES_MANAGE];
const READ = [EVALUATIONS_PERMISSIONS.READ];
const CREATE = [EVALUATIONS_PERMISSIONS.CREATE];
const UPDATE = [EVALUATIONS_PERMISSIONS.UPDATE];
const DELETE = [EVALUATIONS_PERMISSIONS.DELETE];
const ALL = [...TEMPLATE_PERMS, ...READ, ...CREATE, ...UPDATE, ...DELETE];

describe('EvaluationsController (integration)', () => {
  let ctx: PackageTestApp;
  let testUserId: string;
  const testEntityType = 'interviews';
  const testEntityId = randomUUID();

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
    testUserId = randomUUID();
    await ctx.db.execute(
      sql`INSERT INTO users (id, email, first_name, last_name, user_type, updated_at) VALUES (${testUserId}, ${`eval-${Date.now()}@example.com`}, ${'Test'}, ${'Evaluator'}, ${'admin'}, NOW())`,
    );
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createTemplate(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: `Scorecard ${seq}`,
      slug: `scorecard-${Date.now()}-${seq}`,
      entityType: testEntityType,
      criteria: [
        { name: 'Problem Solving', description: 'Analytical skills' },
        { name: 'Communication', description: 'Clear communication' },
      ],
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/evaluation-templates')
      .set(withAuth(ALL))
      .send(body)
      .expect(201);
    return res.body;
  }

  async function createEvaluation(
    templateId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const body = {
      templateId,
      entityType: testEntityType,
      entityId: testEntityId,
      overallRating: 4,
      recommendation: 'yes',
      comment: 'Good candidate',
      scores: [
        { criteriaName: 'Problem Solving', score: 4, note: 'Solid' },
        { criteriaName: 'Communication', score: 5, note: 'Excellent' },
      ],
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/evaluations')
      .set(withAuth(ALL, { userId: testUserId }))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── CRUD ────────────────────────────────────────────────────

  describe('POST /api/v1/evaluations', () => {
    it('should create an evaluation', async () => {
      const template = await createTemplate();
      const evaluation = await createEvaluation(template.id);

      expect(evaluation).toMatchObject({
        id: expect.any(String),
        templateId: template.id,
        entityType: testEntityType,
        entityId: testEntityId,
        overallRating: 4,
        recommendation: 'yes',
      });
    });

    it('should reject missing templateId', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/evaluations')
        .set(withAuth(ALL, { userId: testUserId }))
        .send({
          entityType: testEntityType,
          entityId: testEntityId,
          overallRating: 4,
          recommendation: 'yes',
          scores: [],
        })
        .expect(400);
    });

    it('should reject invalid overallRating', async () => {
      const template = await createTemplate();

      await request(ctx.httpServer)
        .post('/api/v1/evaluations')
        .set(withAuth(ALL, { userId: testUserId }))
        .send({
          templateId: template.id,
          entityType: testEntityType,
          entityId: testEntityId,
          overallRating: 10,
          recommendation: 'yes',
          scores: [],
        })
        .expect(400);
    });

    it('should reject invalid recommendation', async () => {
      const template = await createTemplate();

      await request(ctx.httpServer)
        .post('/api/v1/evaluations')
        .set(withAuth(ALL, { userId: testUserId }))
        .send({
          templateId: template.id,
          entityType: testEntityType,
          entityId: testEntityId,
          overallRating: 4,
          recommendation: 'maybe',
          scores: [],
        })
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      const template = await createTemplate();

      await request(ctx.httpServer)
        .post('/api/v1/evaluations')
        .set(withAuth(ALL, { userId: testUserId }))
        .send({
          templateId: template.id,
          entityType: testEntityType,
          entityId: testEntityId,
          overallRating: 4,
          recommendation: 'yes',
          scores: [],
          hackField: 'injected',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/evaluations', () => {
    it('should list evaluations for an entity', async () => {
      const template = await createTemplate();
      await createEvaluation(template.id);
      await createEvaluation(template.id, { overallRating: 3, recommendation: 'no' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/evaluations?entityType=${testEntityType}&entityId=${testEntityId}`)
        .set(withAuth(ALL, { userId: testUserId }))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({ page: 1, total: 2 });
    });

    it('should return empty for entity with no evaluations', async () => {
      const res = await request(ctx.httpServer)
        .get(`/api/v1/evaluations?entityType=${testEntityType}&entityId=${randomUUID()}`)
        .set(withAuth(ALL, { userId: testUserId }))
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/evaluations/:id', () => {
    it('should return an evaluation by ID', async () => {
      const template = await createTemplate();
      const evaluation = await createEvaluation(template.id);

      const res = await request(ctx.httpServer)
        .get(`/api/v1/evaluations/${evaluation.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: evaluation.id, overallRating: 4 });
    });

    it('should return 404 for non-existent evaluation', async () => {
      await request(ctx.httpServer)
        .get(`/api/v1/evaluations/${randomUUID()}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/evaluations/:id', () => {
    it('should update evaluation rating', async () => {
      const template = await createTemplate();
      const evaluation = await createEvaluation(template.id);

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/evaluations/${evaluation.id}`)
        .set(withAuth([...READ, ...UPDATE], { userId: testUserId }))
        .send({ overallRating: 5, recommendation: 'strong_yes' })
        .expect(200);

      expect(res.body.overallRating).toBe(5);
      expect(res.body.recommendation).toBe('strong_yes');
    });

    it('should reject update by non-author', async () => {
      const template = await createTemplate();
      const evaluation = await createEvaluation(template.id);

      await request(ctx.httpServer)
        .patch(`/api/v1/evaluations/${evaluation.id}`)
        .set(withAuth([...READ, ...UPDATE], { userId: randomUUID() }))
        .send({ overallRating: 1 })
        .expect(403);
    });
  });

  describe('DELETE /api/v1/evaluations/:id', () => {
    it('should delete an evaluation by the evaluator', async () => {
      const template = await createTemplate();
      const evaluation = await createEvaluation(template.id);

      await request(ctx.httpServer)
        .delete(`/api/v1/evaluations/${evaluation.id}`)
        .set(withAuth([...READ, ...DELETE], { userId: testUserId }))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/evaluations/${evaluation.id}`)
        .set(withAuth(READ))
        .expect(404);
    });

    it('should reject deletion by non-author', async () => {
      const template = await createTemplate();
      const evaluation = await createEvaluation(template.id);

      await request(ctx.httpServer)
        .delete(`/api/v1/evaluations/${evaluation.id}`)
        .set(withAuth([...READ, ...DELETE], { userId: randomUUID() }))
        .expect(403);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get(`/api/v1/evaluations?entityType=${testEntityType}&entityId=${testEntityId}`)
        .expect(401);
    });

    it('should return 403 with read-only on create endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/evaluations')
        .set(withAuth(READ, { userId: testUserId }))
        .send({
          templateId: randomUUID(),
          entityType: testEntityType,
          entityId: testEntityId,
          overallRating: 4,
          recommendation: 'yes',
          scores: [],
        })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get(`/api/v1/evaluations?entityType=${testEntityType}&entityId=${testEntityId}`)
        .set(withAuth(['*'], { userId: testUserId }))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
