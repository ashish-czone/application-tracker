import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import { createLaw } from './setup/fixtures';

const READ = ['compliance_rules.read'];
const MANAGE = [
  'compliance_rules.read',
  'compliance_rules.create',
  'compliance_rules.update',
  'compliance_rules.delete',
];

describe('Compliance Rules (integration)', () => {
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

  // Entity-engine's required-check fires for every NOT-NULL column even when
  // a defaultValue is declared on the config — keep the full shape here so
  // each test doesn't have to repeat the workaround.
  async function createRule(overrides: Record<string, unknown> = {}) {
    const { id: lawId } = await createLaw(ctx.db);
    const body = {
      code: unique('RULE'),
      name: 'Test Rule',
      lawId,
      frequency: 'monthly',
      dueDayOfMonth: 20,
      dueMonthOffset: 1,
      gracePeriodDays: 0,
      active: true,
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/compliance_rules')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  describe('POST /api/v1/compliance_rules', () => {
    it('creates a rule', async () => {
      const { id: lawId } = await createLaw(ctx.db);
      const code = unique('RULE');
      const res = await request(ctx.httpServer)
        .post('/api/v1/compliance_rules')
        .set(withAuth(MANAGE))
        .send({
          code,
          name: 'Monthly GST',
          lawId,
          frequency: 'monthly',
          dueDayOfMonth: 20,
          dueMonthOffset: 1,
          gracePeriodDays: 0,
          active: true,
        })
        .expect(201);

      expect(res.body).toMatchObject({ id: expect.any(String), code, lawId });
    });

    it('rejects duplicate code', async () => {
      const { code } = await createRule();
      const { id: lawId } = await createLaw(ctx.db);
      await request(ctx.httpServer)
        .post('/api/v1/compliance_rules')
        .set(withAuth(MANAGE))
        .send({
          code,
          name: 'Dup',
          lawId,
          frequency: 'monthly',
          dueDayOfMonth: 1,
          dueMonthOffset: 0,
          gracePeriodDays: 0,
          active: true,
        })
        .expect(409);
    });

    it('rejects missing lawId', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/compliance_rules')
        .set(withAuth(MANAGE))
        .send({
          code: unique('X'),
          name: 'X',
          frequency: 'monthly',
          dueDayOfMonth: 1,
          dueMonthOffset: 0,
          gracePeriodDays: 0,
        })
        .expect(400);
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/compliance_rules')
        .send({ code: unique('X'), name: 'X' })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/compliance_rules')
        .set(withAuth(READ))
        .send({ code: unique('X'), name: 'X' })
        .expect(403);
    });
  });

  describe('GET /api/v1/compliance_rules', () => {
    it('lists rules', async () => {
      await createRule({ code: unique('A') });
      await createRule({ code: unique('B') });

      const res = await request(ctx.httpServer)
        .get('/api/v1/compliance_rules')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/v1/compliance_rules/:id', () => {
    it('returns a rule', async () => {
      const rule = await createRule();
      const res = await request(ctx.httpServer)
        .get(`/api/v1/compliance_rules/${rule.id}`)
        .set(withAuth(READ))
        .expect(200);
      expect(res.body.id).toBe(rule.id);
    });

    it('returns 404 for unknown id', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/compliance_rules/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/compliance_rules/:id', () => {
    it('updates a rule', async () => {
      const rule = await createRule();
      const res = await request(ctx.httpServer)
        .patch(`/api/v1/compliance_rules/${rule.id}`)
        .set(withAuth(MANAGE))
        .send({ frequency: 'quarterly' })
        .expect(200);
      expect(res.body.frequency).toBe('quarterly');
    });
  });

  describe('workflow: draft → active → deprecated', () => {
    it('transitions draft → active', async () => {
      const rule = await createRule();
      await request(ctx.httpServer)
        .post(`/api/v1/compliance_rules/${rule.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(201);
    });

    it('rejects invalid transition (draft → bogus)', async () => {
      const rule = await createRule();
      await request(ctx.httpServer)
        .post(`/api/v1/compliance_rules/${rule.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'bogus' })
        .expect(400);
    });
  });
});
