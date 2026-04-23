import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { DrizzleDB } from '@packages/database';
import { orgUnitMembers } from '@packages/org-units';
import type { ScopeSpec } from '@packages/rbac';
import { type PackageTestApp } from '@packages/platform-testing';
import { createComplianceTestApp, resetComplianceTestDb } from './setup/app';
import {
  createClient,
  createFiling,
  createLaw,
  createOrgUnit,
  createOrgUnitLevel,
  createRegistration,
  createRule,
  createUser,
} from './setup/fixtures';

/**
 * Row-level scope enforcement for compliance-filings.
 *
 * The sibling `compliance-filings.integration.test.ts` uses the `*` wildcard
 * permission in its JWT, which short-circuits the scope resolver to
 * unrestricted access. This file exercises the real scope matrix by emitting
 * JWTs with scope arrays (`{ type: 'unit' }`, `{ type: 'assigned' }`), which
 * matches how production callers are granted permissions via the seeded
 * Preparer / Team Lead roles.
 *
 * Scopes on transition-specific verbs (pickup/complete/reject/…) are not
 * asserted here: today the `/transition` route builds its accessCtx from the
 * generic `update` permission, so narrower transition-verb scopes are inert.
 * See the seed header in `domains/compliance/api/shared/seeds/system-roles.ts`
 * for the full note.
 */
function withScopedAuth(
  userId: string,
  scopes: Record<string, ScopeSpec[]>,
): Record<string, string> {
  return {
    'x-test-user': JSON.stringify({
      userId,
      userType: 'admin',
      permissions: scopes,
    }),
  };
}

async function joinUnit(db: DrizzleDB, userId: string, unitId: string): Promise<void> {
  await db.insert(orgUnitMembers).values({ userId, orgUnitId: unitId });
}

describe('Compliance Filings — scope matrix (integration)', () => {
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
   * Two units, three users (Alice+Bob in unitA, Charlie in unitB), plus a
   * law/rule/client/registration chain so filings can actually be created.
   */
  async function seedTwoUnitsWithMembers() {
    const { id: levelId } = await createOrgUnitLevel(ctx.db);
    const { id: unitA } = await createOrgUnit(ctx.db, levelId);
    const { id: unitB } = await createOrgUnit(ctx.db, levelId);
    const { id: alice } = await createUser(ctx.db);
    const { id: bob } = await createUser(ctx.db);
    const { id: charlie } = await createUser(ctx.db);
    await joinUnit(ctx.db, alice, unitA);
    await joinUnit(ctx.db, bob, unitA);
    await joinUnit(ctx.db, charlie, unitB);
    const { id: lawId } = await createLaw(ctx.db);
    const { id: ruleId } = await createRule(ctx.db, lawId);
    const { id: clientId } = await createClient(ctx.db);
    await createRegistration(ctx.db, clientId, lawId);
    return { unitA, unitB, alice, bob, charlie, lawId, ruleId, clientId };
  }

  describe('Preparer: read scope = unit', () => {
    it('list returns only filings whose assigneeTeamId is in the actor\'s units', async () => {
      const s = await seedTwoUnitsWithMembers();
      // Distinct period_start values — the (rule_id, client_id, period_start)
      // unique constraint rejects two filings otherwise.
      await createFiling(
        ctx.db,
        { ruleId: s.ruleId, clientId: s.clientId, lawId: s.lawId, assigneeTeamId: s.unitA, createdBy: s.alice },
        { title: 'A-filing', periodStart: '2026-03-01', periodEnd: '2026-03-31' },
      );
      await createFiling(
        ctx.db,
        { ruleId: s.ruleId, clientId: s.clientId, lawId: s.lawId, assigneeTeamId: s.unitB, createdBy: s.charlie },
        { title: 'B-filing', periodStart: '2026-04-01', periodEnd: '2026-04-30' },
      );

      const res = await request(ctx.httpServer)
        .get('/api/v1/compliance-filings')
        .set(withScopedAuth(s.alice, { 'compliance-filings.read': [{ type: 'unit' }] }))
        .expect(200);

      const titles = (res.body.data as Array<{ title: string }>).map((r) => r.title);
      expect(titles).toContain('A-filing');
      expect(titles).not.toContain('B-filing');
    });
  });

  describe('Preparer: update scope = assigned', () => {
    it('allows PATCH on a filing assigned to the actor', async () => {
      const s = await seedTwoUnitsWithMembers();
      const { id: filingId } = await createFiling(
        ctx.db,
        { ruleId: s.ruleId, clientId: s.clientId, lawId: s.lawId, assigneeTeamId: s.unitA, createdBy: s.alice },
        { assigneeId: s.alice, title: 'original' },
      );

      await request(ctx.httpServer)
        .patch(`/api/v1/compliance-filings/${filingId}`)
        .set(withScopedAuth(s.alice, { 'compliance-filings.update': [{ type: 'assigned' }] }))
        .send({ title: 'updated' })
        .expect(200);
    });

    it('blocks PATCH on a teammate\'s assigned filing', async () => {
      const s = await seedTwoUnitsWithMembers();
      // Filing sits in Alice's unit but is assigned to Bob — `assigned` scope
      // narrows to rows where assigneeId = actor, so Alice can't see it.
      const { id: filingId } = await createFiling(
        ctx.db,
        { ruleId: s.ruleId, clientId: s.clientId, lawId: s.lawId, assigneeTeamId: s.unitA, createdBy: s.alice },
        { assigneeId: s.bob },
      );

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/compliance-filings/${filingId}`)
        .set(withScopedAuth(s.alice, { 'compliance-filings.update': [{ type: 'assigned' }] }))
        .send({ title: 'updated' });
      // The scope filter zeros out the target row, so findOneOrFail throws
      // NotFoundException (404) rather than ForbiddenException (403). Both
      // outcomes mean "not permitted"; accept either so we don't brittle-pin
      // an implementation detail.
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('Team Lead: update scope = unit', () => {
    it('allows PATCH on any filing in the actor\'s unit regardless of assignee', async () => {
      const s = await seedTwoUnitsWithMembers();
      const { id: filingId } = await createFiling(
        ctx.db,
        { ruleId: s.ruleId, clientId: s.clientId, lawId: s.lawId, assigneeTeamId: s.unitA, createdBy: s.alice },
        { assigneeId: s.bob, title: 'original' },
      );

      await request(ctx.httpServer)
        .patch(`/api/v1/compliance-filings/${filingId}`)
        .set(withScopedAuth(s.alice, { 'compliance-filings.update': [{ type: 'unit' }] }))
        .send({ title: 'updated' })
        .expect(200);
    });

    it('blocks PATCH on a filing in a different unit', async () => {
      const s = await seedTwoUnitsWithMembers();
      const { id: filingId } = await createFiling(
        ctx.db,
        { ruleId: s.ruleId, clientId: s.clientId, lawId: s.lawId, assigneeTeamId: s.unitB, createdBy: s.charlie },
        { assigneeId: s.charlie },
      );

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/compliance-filings/${filingId}`)
        .set(withScopedAuth(s.alice, { 'compliance-filings.update': [{ type: 'unit' }] }))
        .send({ title: 'updated' });
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('any scope collapses to unrestricted', () => {
    it('allows PATCH across unit boundaries', async () => {
      const s = await seedTwoUnitsWithMembers();
      const { id: filingId } = await createFiling(
        ctx.db,
        { ruleId: s.ruleId, clientId: s.clientId, lawId: s.lawId, assigneeTeamId: s.unitB, createdBy: s.charlie },
        { assigneeId: s.charlie, title: 'original' },
      );

      await request(ctx.httpServer)
        .patch(`/api/v1/compliance-filings/${filingId}`)
        .set(withScopedAuth(s.alice, { 'compliance-filings.update': [{ type: 'any' }] }))
        .send({ title: 'updated' })
        .expect(200);
    });
  });
});
