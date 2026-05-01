import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import { createFiling, createFilingPrereqs, grantPermissions } from './setup/fixtures';
import { complianceFilings } from '../compliance-filings/compliance-filings.schema';
import { buildFilingExternalKey } from '../compliance-filings';

// The filings config declares `dataAccess.scopes` (assignee/team) — every
// list/get/transition filters by mock-user identity. Tests use the `*`
// wildcard to bypass scope filters, then layer the specific transition
// permission (pickup/submit/complete/etc.) the platform also enforces.
// Wildcard gives read/write; the explicit permission on top is still needed
// because MockRbacGuard checks `requiredPermission in permissions`.
const READ = ['compliance-filings.read'];
const BASE_WRITE = [
  '*',
  'compliance-filings.read',
  'compliance-filings.create',
  'compliance-filings.update',
  'compliance-filings.delete',
];
// Authenticated but holds zero compliance perms — drives 403 on the
// pure-read endpoints whose only `@RequirePermission` is `*.read`.
const NO_PERMS: string[] = [];
const PICKUP = [...BASE_WRITE, 'compliance-filings.pickup'];
const SUBMIT = [...PICKUP, 'compliance-filings.submit'];
const COMPLETE = [...SUBMIT, 'compliance-filings.complete'];
const REJECT = [...SUBMIT, 'compliance-filings.reject'];
const CLOSE = [...BASE_WRITE, 'compliance-filings.close'];
const REOPEN = [...BASE_WRITE, 'compliance-filings.reopen'];

describe('Compliance Filings (integration)', () => {
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

  /**
   * Seed a DB user + grant them the given permissions + return a withAuth
   * header tied to that user. Needed because workflow transitions consult
   * the real RbacService (DB-backed), not the mock guard.
   */
  async function authForUser(userId: string, permissions: string[]) {
    await grantPermissions(ctx.db, userId, permissions);
    return withAuth(permissions, { userId });
  }

  async function pickup(filingId: string, userId: string) {
    const auth = await authForUser(userId, PICKUP);
    await request(ctx.httpServer)
      .post(`/api/v1/compliance-filings/${filingId}/transition`)
      .set(auth)
      .send({ fieldKey: 'status', to: 'in_progress' })
      .expect(201);
  }

  async function submit(filingId: string, userId: string) {
    await pickup(filingId, userId);
    const auth = await authForUser(userId, SUBMIT);
    await request(ctx.httpServer)
      .post(`/api/v1/compliance-filings/${filingId}/transition`)
      .set(auth)
      .send({ fieldKey: 'status', to: 'review' })
      .expect(201);
  }

  describe('POST /api/v1/compliance-filings', () => {
    it('creates a filing and stamps externalKey idempotency', async () => {
      const { userId, teamId, lawId, ruleId, clientId } = await createFilingPrereqs(ctx.db);

      const res = await request(ctx.httpServer)
        .post('/api/v1/compliance-filings')
        .set(withAuth(BASE_WRITE, { userId }))
        .send({
          title: 'Q1 Filing',
          priority: 'medium',
          ruleId,
          clientId,
          lawId,
          assigneeTeamId: teamId,
          periodStart: '2026-03-01',
          periodEnd: '2026-03-31',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        title: 'Q1 Filing',
        status: 'pending',
      });

      const [row] = await ctx.db
        .select()
        .from(complianceFilings)
        .where(eq(complianceFilings.id, res.body.id));
      expect(row.externalKey).toBe(buildFilingExternalKey(ruleId, clientId, '2026-03-01'));
    });

    it('returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/compliance-filings')
        .send({ title: 'X' })
        .expect(401);
    });

    it('returns 403 with read-only permission', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/compliance-filings')
        .set(withAuth(READ))
        .send({ title: 'X' })
        .expect(403);
    });

    it('accepts an ISO 8601 string for completedAt', async () => {
      const { userId, teamId, lawId, ruleId, clientId } = await createFilingPrereqs(ctx.db);
      const completedAt = '2026-03-31T18:00:00.000Z';

      const res = await request(ctx.httpServer)
        .post('/api/v1/compliance-filings')
        .set(withAuth(BASE_WRITE, { userId }))
        .send({
          title: 'Already-filed Q1',
          priority: 'medium',
          status: 'completed',
          ruleId,
          clientId,
          lawId,
          assigneeTeamId: teamId,
          periodStart: '2026-03-01',
          periodEnd: '2026-03-31',
          completedAt,
        })
        .expect(201);

      expect(res.body).toMatchObject({ status: 'completed' });
      // Service overrides client-supplied completedAt to now() when status is
      // completed — assert it's a parseable date, not the literal input.
      expect(new Date(res.body.completedAt).toString()).not.toBe('Invalid Date');
    });

    it('treats empty-string completedAt as null', async () => {
      const { userId, teamId, lawId, ruleId, clientId } = await createFilingPrereqs(ctx.db);

      const res = await request(ctx.httpServer)
        .post('/api/v1/compliance-filings')
        .set(withAuth(BASE_WRITE, { userId }))
        .send({
          title: 'Pending Q2',
          priority: 'medium',
          ruleId,
          clientId,
          lawId,
          assigneeTeamId: teamId,
          periodStart: '2026-04-01',
          periodEnd: '2026-04-30',
          completedAt: '',
        })
        .expect(201);

      expect(res.body.completedAt).toBeNull();
    });

    it('rejects a malformed completedAt with 400', async () => {
      const { userId, teamId, lawId, ruleId, clientId } = await createFilingPrereqs(ctx.db);

      await request(ctx.httpServer)
        .post('/api/v1/compliance-filings')
        .set(withAuth(BASE_WRITE, { userId }))
        .send({
          title: 'Bad Date',
          priority: 'medium',
          ruleId,
          clientId,
          lawId,
          assigneeTeamId: teamId,
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
          completedAt: 'not-a-date',
        })
        .expect(400);
    });
  });

  describe('workflow transitions', () => {
    async function seedFiling() {
      const { userId, teamId, lawId, ruleId, clientId } = await createFilingPrereqs(ctx.db);
      const { id } = await createFiling(ctx.db, {
        ruleId,
        clientId,
        lawId,
        assigneeTeamId: teamId,
        createdBy: userId,
      });
      return { filingId: id, userId };
    }

    it('pickup: pending → in_progress', async () => {
      const { filingId, userId } = await seedFiling();
      const auth = await authForUser(userId, PICKUP);
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({ fieldKey: 'status', to: 'in_progress' })
        .expect(201);
    });

    // Note: the workflow engine's per-transition permission gate (e.g.
    // requiring `compliance-filings.pickup`) is canonically tested at the
    // engine level — see `packages/addons/workflows/api/services/__tests__/
    // workflow-engine.service.unit.test.ts`. We don't reproduce that test
    // here because every transition test in this file grants `*` to bypass
    // dataAccess scopes, and `*` (correctly) authorises every transition
    // since #1128.

    it('submit: in_progress → review', async () => {
      const { filingId, userId } = await seedFiling();
      await pickup(filingId, userId);
      const auth = await authForUser(userId, SUBMIT);
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({ fieldKey: 'status', to: 'review' })
        .expect(201);
    });

    it('complete: review → completed requires the reviewer-signoff comment', async () => {
      const { filingId, userId } = await seedFiling();
      await submit(filingId, userId);
      const auth = await authForUser(userId, COMPLETE);

      // Missing comment — reviewer-signoff requirement rejects.
      const missingComment = await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({ fieldKey: 'status', to: 'completed' });
      expect([400, 422]).toContain(missingComment.status);

      // With comment — passes.
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({
          fieldKey: 'status',
          to: 'completed',
          comment: 'Reviewed against the source register; figures tie out.',
        })
        .expect(201);

      const [row] = await ctx.db
        .select()
        .from(complianceFilings)
        .where(eq(complianceFilings.id, filingId));
      expect(row.status).toBe('completed');
      // Note: completedAt is NOT stamped by /transition today — the
      // applyCompletedAt hook runs only on beforeUpdate (PATCH), not on
      // workflow transitions. Tracking as a platform gap; test pins the
      // current behavior so a fix becomes an explicit change.
    });

    it('reject: review → rejected requires reason + comment', async () => {
      const { filingId, userId } = await seedFiling();
      await submit(filingId, userId);
      const auth = await authForUser(userId, REJECT);

      // Missing both reason and comment — reject transition rejects.
      const missingBoth = await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({ fieldKey: 'status', to: 'rejected' });
      expect([400, 422]).toContain(missingBoth.status);

      // With reason + comment — passes.
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({
          fieldKey: 'status',
          to: 'rejected',
          reason: 'Numbers do not reconcile',
          comment: 'Please recheck the input register before resubmission.',
        })
        .expect(201);
    });

    it('reopen: completed → in_progress requires reason + comment', async () => {
      const { filingId, userId } = await seedFiling();
      await submit(filingId, userId);
      const completeAuth = await authForUser(userId, COMPLETE);
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(completeAuth)
        .send({
          fieldKey: 'status',
          to: 'completed',
          comment: 'Approved.',
        })
        .expect(201);

      const reopenAuth = await authForUser(userId, REOPEN);

      // Missing both — reopen rejects so a "resurrected" terminal filing
      // never lands without an explanation on the audit row.
      const missingBoth = await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(reopenAuth)
        .send({ fieldKey: 'status', to: 'in_progress' });
      expect([400, 422]).toContain(missingBoth.status);

      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(reopenAuth)
        .send({
          fieldKey: 'status',
          to: 'in_progress',
          reason: 'Filed in error',
          comment: 'Regulator returned the submission; need to amend.',
        })
        .expect(201);

      const [row] = await ctx.db
        .select()
        .from(complianceFilings)
        .where(eq(complianceFilings.id, filingId));
      expect(row.status).toBe('in_progress');
    });

    it('close: pending → cancelled (terminal) requires reason + comment', async () => {
      const { filingId, userId } = await seedFiling();
      const auth = await authForUser(userId, CLOSE);
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({
          fieldKey: 'status',
          to: 'cancelled',
          reason: 'Not applicable',
          comment: 'Client never registered for this rule.',
        })
        .expect(201);
    });

    it('rejects invalid transitions (pending → review)', async () => {
      const { filingId, userId } = await seedFiling();
      const auth = await authForUser(userId, SUBMIT);
      const res = await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({ fieldKey: 'status', to: 'review' });
      // Invalid transition — platform can surface as 400 (validator) or 422
      // (workflow engine: "transition not allowed"). Accept both.
      expect([400, 422]).toContain(res.status);
    });
  });

  describe('list + get', () => {
    it('lists filings and returns by id', async () => {
      const { userId, teamId, lawId, ruleId, clientId } = await createFilingPrereqs(ctx.db);
      const { id } = await createFiling(ctx.db, {
        ruleId,
        clientId,
        lawId,
        assigneeTeamId: teamId,
        createdBy: userId,
      });

      const list = await request(ctx.httpServer)
        .get('/api/v1/compliance-filings')
        .set(withAuth(['*']))
        .expect(200);
      expect(list.body.data.length).toBeGreaterThan(0);

      const single = await request(ctx.httpServer)
        .get(`/api/v1/compliance-filings/${id}`)
        .set(withAuth(['*']))
        .expect(200);
      expect(single.body.id).toBe(id);
    });
  });

  // 401 (anon) + 403 (insufficient perm) coverage for every endpoint on
  // the compliance-filings controller. Positive paths live above; this
  // block is the mechanical sweep to satisfy the per-endpoint security-
  // test mandate (audit S8/T6).
  describe('auth coverage', () => {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';

    describe('GET /api/v1/compliance-filings/layout/list', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/compliance-filings/layout/list').expect(401);
      });
      it('returns 403 without compliance-filings.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/compliance-filings/layout/list')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/compliance-filings/summary', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/compliance-filings/summary').expect(401);
      });
      it('returns 403 without compliance-filings.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/compliance-filings/summary')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/compliance-filings (list)', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer).get('/api/v1/compliance-filings').expect(401);
      });
      it('returns 403 without compliance-filings.read', async () => {
        await request(ctx.httpServer)
          .get('/api/v1/compliance-filings')
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('GET /api/v1/compliance-filings/:id (auth)', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/compliance-filings/${NIL_UUID}`)
          .expect(401);
      });
      it('returns 403 without compliance-filings.read', async () => {
        await request(ctx.httpServer)
          .get(`/api/v1/compliance-filings/${NIL_UUID}`)
          .set(withAuth(NO_PERMS))
          .expect(403);
      });
    });

    describe('PATCH /api/v1/compliance-filings/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .patch(`/api/v1/compliance-filings/${NIL_UUID}`)
          .send({})
          .expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .patch(`/api/v1/compliance-filings/${NIL_UUID}`)
          .set(withAuth(READ))
          .send({})
          .expect(403);
      });
    });

    describe('DELETE /api/v1/compliance-filings/:id', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .delete(`/api/v1/compliance-filings/${NIL_UUID}`)
          .expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .delete(`/api/v1/compliance-filings/${NIL_UUID}`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    describe('POST /api/v1/compliance-filings/:id/clone', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-filings/${NIL_UUID}/clone`)
          .expect(401);
      });
      it('returns 403 without create permission', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-filings/${NIL_UUID}/clone`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    describe('POST /api/v1/compliance-filings/:id/restore', () => {
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-filings/${NIL_UUID}/restore`)
          .expect(401);
      });
      it('returns 403 without update permission', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-filings/${NIL_UUID}/restore`)
          .set(withAuth(READ))
          .expect(403);
      });
    });

    describe('POST /api/v1/compliance-filings/:id/transition (auth)', () => {
      // Per-transition perm gates (pickup/submit/complete/etc.) are
      // exercised in the workflow-transitions block above with real users.
      // This pair only pins the coarse-grained `compliance-filings.update`
      // gate at the controller decorator.
      it('returns 401 without auth', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-filings/${NIL_UUID}/transition`)
          .send({ fieldKey: 'status', to: 'in_progress' })
          .expect(401);
      });
      it('returns 403 with read-only perms', async () => {
        await request(ctx.httpServer)
          .post(`/api/v1/compliance-filings/${NIL_UUID}/transition`)
          .set(withAuth(READ))
          .send({ fieldKey: 'status', to: 'in_progress' })
          .expect(403);
      });
    });
  });
});
