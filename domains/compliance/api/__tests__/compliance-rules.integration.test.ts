import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import {
  createLaw,
  createFiling,
  createFilingPrereqs,
} from './setup/fixtures';

const READ = ['compliance-rules.read'];
const MANAGE = [
  'compliance-rules.read',
  'compliance-rules.create',
  'compliance-rules.update',
  'compliance-rules.delete',
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
      .post('/api/v1/compliance-rules')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  describe('POST /api/v1/compliance-rules', () => {
    it('creates a rule', async () => {
      const { id: lawId } = await createLaw(ctx.db);
      const code = unique('RULE');
      const res = await request(ctx.httpServer)
        .post('/api/v1/compliance-rules')
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
        .post('/api/v1/compliance-rules')
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
        .post('/api/v1/compliance-rules')
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
        .post('/api/v1/compliance-rules')
        .send({ code: unique('X'), name: 'X' })
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/compliance-rules')
        .set(withAuth(READ))
        .send({ code: unique('X'), name: 'X' })
        .expect(403);
    });
  });

  describe('GET /api/v1/compliance-rules', () => {
    it('lists rules', async () => {
      await createRule({ code: unique('A') });
      await createRule({ code: unique('B') });

      const res = await request(ctx.httpServer)
        .get('/api/v1/compliance-rules')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/v1/compliance-rules/:id', () => {
    it('returns a rule', async () => {
      const rule = await createRule();
      const res = await request(ctx.httpServer)
        .get(`/api/v1/compliance-rules/${rule.id}`)
        .set(withAuth(READ))
        .expect(200);
      expect(res.body.id).toBe(rule.id);
    });

    it('returns 404 for unknown id', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/compliance-rules/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/compliance-rules/:id', () => {
    it('updates a rule', async () => {
      const rule = await createRule();
      const res = await request(ctx.httpServer)
        .patch(`/api/v1/compliance-rules/${rule.id}`)
        .set(withAuth(MANAGE))
        .send({ frequency: 'quarterly' })
        .expect(200);
      expect(res.body.frequency).toBe('quarterly');
    });

    describe('I14: identity-field immutability once filings exist', () => {
      async function seedRuleWithFiling() {
        // createFilingPrereqs builds the full user/org-unit/law/rule/client
        // chain; we write the filing row directly so the guard sees the
        // rule as "has generated filings" without depending on the
        // generator automation firing.
        const { userId, teamId, lawId, ruleId, clientId } = await createFilingPrereqs(ctx.db);
        await createFiling(ctx.db, {
          ruleId, clientId, lawId, assigneeTeamId: teamId, createdBy: userId,
        });
        return { ruleId, lawId };
      }

      it('blocks a code change with 400 RULE_FIELD_IMMUTABLE', async () => {
        const { ruleId } = await seedRuleWithFiling();
        const res = await request(ctx.httpServer)
          .patch(`/api/v1/compliance-rules/${ruleId}`)
          .set(withAuth(MANAGE))
          .send({ code: 'NEW-CODE' })
          .expect(400);
        expect(res.body).toMatchObject({
          code: 'RULE_FIELD_IMMUTABLE',
          fields: ['code'],
        });
      });

      it('blocks a frequency change with 400 and lists only the changed field', async () => {
        const { ruleId } = await seedRuleWithFiling();
        const res = await request(ctx.httpServer)
          .patch(`/api/v1/compliance-rules/${ruleId}`)
          .set(withAuth(MANAGE))
          .send({ frequency: 'quarterly' })
          .expect(400);
        expect(res.body.fields).toEqual(['frequency']);
      });

      it('blocks a lawId change with 400', async () => {
        const { ruleId } = await seedRuleWithFiling();
        const { id: otherLawId } = await createLaw(ctx.db);
        const res = await request(ctx.httpServer)
          .patch(`/api/v1/compliance-rules/${ruleId}`)
          .set(withAuth(MANAGE))
          .send({ lawId: otherLawId })
          .expect(400);
        expect(res.body.fields).toEqual(['lawId']);
      });

      it('allows cosmetic + forward-only edits on a rule that already has filings', async () => {
        const { ruleId } = await seedRuleWithFiling();
        const res = await request(ctx.httpServer)
          .patch(`/api/v1/compliance-rules/${ruleId}`)
          .set(withAuth(MANAGE))
          .send({
            name: 'Updated name',
            description: 'Updated description',
            dueDayOfMonth: 25,
            dueMonthOffset: 2,
            gracePeriodDays: 5,
          })
          .expect(200);
        expect(res.body).toMatchObject({
          name: 'Updated name',
          dueDayOfMonth: 25,
          dueMonthOffset: 2,
          gracePeriodDays: 5,
        });
      });

      it('allows identity-field changes on a rule that has no filings', async () => {
        // No filing seeded — guard passes through even for identity fields.
        const rule = await createRule();
        await request(ctx.httpServer)
          .patch(`/api/v1/compliance-rules/${rule.id}`)
          .set(withAuth(MANAGE))
          .send({ code: 'NEW-CODE' })
          .expect(200);
      });
    });
  });

  describe('GET /api/v1/compliance-rules/:id/edit-constraints', () => {
    it('reports hasGeneratedFilings=false + count=0 for a fresh rule', async () => {
      const rule = await createRule();
      const res = await request(ctx.httpServer)
        .get(`/api/v1/compliance-rules/${rule.id}/edit-constraints`)
        .set(withAuth(MANAGE))
        .expect(200);
      expect(res.body).toEqual({
        ruleId: rule.id,
        hasGeneratedFilings: false,
        generatedFilingCount: 0,
      });
    });

    it('reports hasGeneratedFilings=true with the exact count once filings exist', async () => {
      const { userId, teamId, lawId, ruleId, clientId } = await createFilingPrereqs(ctx.db);
      await createFiling(ctx.db, { ruleId, clientId, lawId, assigneeTeamId: teamId, createdBy: userId });
      await createFiling(ctx.db, {
        ruleId, clientId, lawId, assigneeTeamId: teamId, createdBy: userId,
        periodStart: '2026-04-01', periodEnd: '2026-04-30',
      });
      const res = await request(ctx.httpServer)
        .get(`/api/v1/compliance-rules/${ruleId}/edit-constraints`)
        .set(withAuth(MANAGE))
        .expect(200);
      expect(res.body).toMatchObject({
        ruleId,
        hasGeneratedFilings: true,
        generatedFilingCount: 2,
      });
    });

    it('returns 401 without auth', async () => {
      const rule = await createRule();
      await request(ctx.httpServer)
        .get(`/api/v1/compliance-rules/${rule.id}/edit-constraints`)
        .expect(401);
    });

    it('returns 403 with read-only perms', async () => {
      const rule = await createRule();
      await request(ctx.httpServer)
        .get(`/api/v1/compliance-rules/${rule.id}/edit-constraints`)
        .set(withAuth(READ))
        .expect(403);
    });

    it('returns 404 for unknown rule id', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/compliance-rules/00000000-0000-0000-0000-000000000000/edit-constraints')
        .set(withAuth(MANAGE))
        .expect(404);
    });
  });

  describe('workflow: draft → active → deprecated', () => {
    it('transitions draft → active', async () => {
      const rule = await createRule();
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(201);
    });

    it('rejects invalid transition (draft → bogus)', async () => {
      const rule = await createRule();
      const res = await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'bogus' });
      // Platform surfaces invalid targets as 422 (workflow engine) or 400
      // (body validation), depending on which layer catches it first.
      expect([400, 422]).toContain(res.status);
    });
  });
});
