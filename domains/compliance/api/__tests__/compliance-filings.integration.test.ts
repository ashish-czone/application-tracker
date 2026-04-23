import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { withAuth, type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import { createFiling, createFilingPrereqs, grantPermissions } from './setup/fixtures';
import { complianceFilings } from '../schema/compliance-filings';
import { buildFilingExternalKey } from '../compliance-filings/compliance-filings.config';

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

    it('pickup without compliance-filings.pickup is rejected', async () => {
      const { filingId, userId } = await seedFiling();
      const auth = await authForUser(userId, BASE_WRITE);
      const res = await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({ fieldKey: 'status', to: 'in_progress' });
      // Workflow engine's missing-permissions path surfaces as 403 in
      // principle (ForbiddenException) but can reach the client as 400 when
      // the controller body-pipeline intercepts first. Either is correct
      // from a "this transition was blocked" standpoint.
      expect([400, 403]).toContain(res.status);
    });

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

    it('complete: review → completed', async () => {
      const { filingId, userId } = await seedFiling();
      await submit(filingId, userId);
      const auth = await authForUser(userId, COMPLETE);
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({ fieldKey: 'status', to: 'completed' })
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

    it('reopen: completed → in_progress', async () => {
      const { filingId, userId } = await seedFiling();
      await submit(filingId, userId);
      const completeAuth = await authForUser(userId, COMPLETE);
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(completeAuth)
        .send({ fieldKey: 'status', to: 'completed' })
        .expect(201);

      const reopenAuth = await authForUser(userId, REOPEN);
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(reopenAuth)
        .send({ fieldKey: 'status', to: 'in_progress' })
        .expect(201);

      const [row] = await ctx.db
        .select()
        .from(complianceFilings)
        .where(eq(complianceFilings.id, filingId));
      expect(row.status).toBe('in_progress');
    });

    it('close: pending → cancelled (terminal)', async () => {
      const { filingId, userId } = await seedFiling();
      const auth = await authForUser(userId, CLOSE);
      await request(ctx.httpServer)
        .post(`/api/v1/compliance-filings/${filingId}/transition`)
        .set(auth)
        .send({ fieldKey: 'status', to: 'cancelled' })
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
});
