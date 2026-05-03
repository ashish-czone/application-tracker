import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import {
  createLaw,
  createLawWithHandler,
  createFiling,
  createFilingPrereqs,
  grantPermissions,
} from './setup/fixtures';
import { DEFAULT_TEST_USER_ID } from '@packages/platform-testing';

const READ = ['compliance-rules.read'];
const MANAGE = [
  'compliance-rules.read',
  'compliance-rules.create',
  'compliance-rules.update',
  'compliance-rules.delete',
];
// Authenticated but holds zero compliance perms — drives 403 on the
// pure-read endpoints whose only `@RequirePermission` is `*.read`.
const NO_PERMS: string[] = [];

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
    const { id: lawId } = await createLawWithHandler(ctx.db);
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
      const { id: lawId } = await createLawWithHandler(ctx.db);
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
      const { id: lawId } = await createLawWithHandler(ctx.db);
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
      await createFiling(
        ctx.db,
        { ruleId, clientId, lawId, assigneeTeamId: teamId, createdBy: userId },
        { periodStart: '2026-04-01', periodEnd: '2026-04-30' },
      );
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

    it('rejects active → deprecated via /transition without compliance-rules.deprecate', async () => {
      // Promote first using the broader MANAGE token.
      const rule = await createRule();
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(201);

      // MANAGE excludes the new dedicated perm — engine rejects.
      const res = await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/transition`)
        .set(withAuth(MANAGE))
        .send({
          fieldKey: 'status',
          to: 'deprecated',
          reason: 'Replaced',
          comment: 'Superseded by RULE-v2',
        });
      expect([400, 403]).toContain(res.status);
    });

    it('allows active → deprecated via /transition with the deprecate perm', async () => {
      // The workflow engine consults `rbacService.getPermissionsForUser`
      // (DB-backed), not the mock-auth header. Grant `compliance-rules.deprecate`
      // to the default test user so the transition's `requiredPermissions`
      // check passes — same pattern as compliance-filings tests.
      await grantPermissions(ctx.db, DEFAULT_TEST_USER_ID, ['compliance-rules.deprecate']);
      const rule = await createRule();
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/transition`)
        .set(withAuth(MANAGE))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(201);

      await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/transition`)
        .set(withAuth([...MANAGE, 'compliance-rules.deprecate']))
        .send({
          fieldKey: 'status',
          to: 'deprecated',
          reason: 'Replaced',
          comment: 'Superseded by RULE-v2',
        })
        .expect(201);
    });
  });

  describe('POST /:id/deprecate', () => {
    it('returns 401 without auth', async () => {
      const rule = await createRule();
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/deprecate`)
        .send({})
        .expect(401);
    });

    it('returns 403 with compliance-rules.update only — needs the dedicated deprecate perm', async () => {
      const rule = await createRule();
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/deprecate`)
        .set(withAuth(MANAGE))
        .send({})
        .expect(403);
    });

    it('succeeds with compliance-rules.deprecate', async () => {
      // Workflow engine reads perms from the DB, not the mock-auth header.
      await grantPermissions(ctx.db, DEFAULT_TEST_USER_ID, ['compliance-rules.deprecate']);
      const rule = await createRule();
      // Bring it to 'active' first so the cascade path is meaningful.
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/transition`)
        .set(withAuth([...MANAGE, 'compliance-rules.deprecate']))
        .send({ fieldKey: 'status', to: 'active' })
        .expect(201);

      const res = await request(ctx.httpServer)
        .post(`/api/v1/compliance-rules/${rule.id}/deprecate`)
        .set(withAuth([...MANAGE, 'compliance-rules.deprecate']))
        .send({ comment: 'Superseded by RULE-v2' })
        .expect(200);
      expect(res.body).toMatchObject({ ruleId: rule.id, status: 'deprecated' });
    });
  });

  // 401 (anon) + 403 (insufficient perm) coverage for the remaining
  // compliance-rules endpoints. Positive paths and the dedicated
  // deprecate / edit-constraints / POST coverage live above; this block
  // is the mechanical sweep to close audit S8/T6.
  describe('auth coverage', () => {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';

    // SKIPPED — these describe blocks exercise routes that no longer exist
    // on the controller. PR #1273 ("de-engine remaining 5 entities") removed
    // the auto-generated entity-engine routes (`GET /<slug>/layout/list`,
    // `POST /<slug>/:id/clone`, `POST /<slug>/:id/restore`) when each
    // module switched from `EntityEngineModule.forEntity` to its own
    // hand-rolled controller. The tests pre-date that migration and now hit
    // 404 instead of the expected 401/403. Skipped pending user approval to
    // delete (per .claude/rules/no-deletes-without-approval). See PR #1298.
    describe.skip('GET /api/v1/compliance-rules/layout/list', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/compliance-rules/layout/list').expect(401);
      });
      it('returns 403 without compliance-rules.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/compliance-rules/layout/list')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/compliance-rules (list, auth)', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/compliance-rules').expect(401);
      });
      it('returns 403 without compliance-rules.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/compliance-rules')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/compliance-rules/summary', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/compliance-rules/summary').expect(401);
      });
      it('returns 403 without compliance-rules.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/compliance-rules/summary')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/compliance-rules/:id (auth)', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/compliance-rules/${NIL_UUID}`)
          .expect(401);
      });
      it('returns 403 without compliance-rules.read', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/compliance-rules/${NIL_UUID}`)
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/compliance-rules/:id/deprecation-preview', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/compliance-rules/${NIL_UUID}/deprecation-preview`)
          .expect(401);
      });
      it('returns 403 without compliance-rules.update', async () => {
        // Preview deliberately reuses the destructive perm so a read-only
        // actor cannot probe the deprecation graph (audit S11 — same
        // rationale as the clients/transition-preview pair).
        await request(ctx.httpServer)
          .get(`/api/v1/compliance-rules/${NIL_UUID}/deprecation-preview`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    describe('PATCH /api/v1/compliance-rules/:id (auth)', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .patch(`/api/v1/compliance-rules/${NIL_UUID}`)
          .send({})
          .expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .patch(`/api/v1/compliance-rules/${NIL_UUID}`)
          .set(withAuth(READ))
          .send({})
          .expect(403);
      });
    });

    describe('DELETE /api/v1/compliance-rules/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .delete(`/api/v1/compliance-rules/${NIL_UUID}`)
          .expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .delete(`/api/v1/compliance-rules/${NIL_UUID}`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    // SKIPPED — these describe blocks exercise routes that no longer exist
    // on the controller. PR #1273 ("de-engine remaining 5 entities") removed
    // the auto-generated entity-engine routes (`GET /<slug>/layout/list`,
    // `POST /<slug>/:id/clone`, `POST /<slug>/:id/restore`) when each
    // module switched from `EntityEngineModule.forEntity` to its own
    // hand-rolled controller. The tests pre-date that migration and now hit
    // 404 instead of the expected 401/403. Skipped pending user approval to
    // delete (per .claude/rules/no-deletes-without-approval). See PR #1298.
    describe.skip('POST /api/v1/compliance-rules/:id/clone', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-rules/${NIL_UUID}/clone`)
          .expect(401);
      });
      it('returns 403 without create permission', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-rules/${NIL_UUID}/clone`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    // SKIPPED — these describe blocks exercise routes that no longer exist
    // on the controller. PR #1273 ("de-engine remaining 5 entities") removed
    // the auto-generated entity-engine routes (`GET /<slug>/layout/list`,
    // `POST /<slug>/:id/clone`, `POST /<slug>/:id/restore`) when each
    // module switched from `EntityEngineModule.forEntity` to its own
    // hand-rolled controller. The tests pre-date that migration and now hit
    // 404 instead of the expected 401/403. Skipped pending user approval to
    // delete (per .claude/rules/no-deletes-without-approval). See PR #1298.
    describe.skip('POST /api/v1/compliance-rules/:id/restore', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-rules/${NIL_UUID}/restore`)
          .expect(401);
      });
      it('returns 403 without update permission', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-rules/${NIL_UUID}/restore`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    describe('POST /api/v1/compliance-rules/:id/transition (controller-level auth)', () => {
      // The per-transition perm gate (`compliance-rules.deprecate` for
      // `* → deprecated`) is exercised in the workflow block above. This
      // pair only pins the coarse-grained `compliance-rules.update` gate
      // at the controller decorator.
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-rules/${NIL_UUID}/transition`)
          .send({ fieldKey: 'status', to: 'active' })
          .expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-rules/${NIL_UUID}/transition`)
          .set(withAuth(READ))
          .send({ fieldKey: 'status', to: 'active' })
          .expect(403);
      });
    });
  });
});
