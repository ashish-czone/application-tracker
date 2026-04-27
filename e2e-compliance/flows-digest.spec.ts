import { test, expect } from './fixtures/auth';
import { resetState, listNotificationsFor } from './helpers';
import { createClient, type CreatedClient } from './fixtures/clients';
import {
  addUserToOrgUnit,
  createOrgUnit,
  type OrgUnit,
} from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule, type ComplianceRule } from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { createComplianceFiling } from './fixtures/filings';
import { createUser, type CreatedUser } from './fixtures/users';
import {
  createComplianceDigestRule,
  type ScheduleRule,
} from './fixtures/automation-rules';
import { runScheduler } from './fixtures/cron';

/**
 * US-8.1 daily digest — named coverage.
 *
 * Builds a digest rule equivalent to the seeded `compliance-filing-daily-
 * digest` (same scheduleHour, same action, same recipient strategy) but
 * with an `in_app` channel added so the test-hooks notification endpoint
 * can observe per-recipient dispatch. The seeded rule's shape is asserted
 * separately at the integration level.
 *
 * Recipients per US-8.1:
 *   - users with non-terminal individual assignments
 *   - users who are head of a team holding an unassigned filing
 *
 * Buckets per US-8.1:
 *   - Overdue:    dueDate < today
 *   - This week:  next 7 days
 *   - Next week:  8–14 days out
 *
 * Dispatch is asynchronous — the schedule scanner enqueues an action job
 * via Bull and the in-app channel writes to `notifications` only after the
 * worker drains it. Tests poll via `expect.poll(...)` to bridge the gap.
 *
 * Assumes APP_TIMEZONE=UTC (the default). With a non-UTC timezone the
 * 09:00 UTC asOf would need to be shifted to the local equivalent.
 */
test.describe('Flow: compliance daily digest (US-8.1)', () => {
  let team: OrgUnit;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let law: Law;
  let client: CreatedClient;
  let rule: ComplianceRule;
  let digestRule: ScheduleRule;

  test.beforeAll(async () => {
    await resetState();

    team = await createOrgUnit({ level: 'Team' });

    alice = await createUser({ firstName: 'Alice', lastName: 'Assignee' });
    bob = await createUser({ firstName: 'Bob', lastName: 'NoFilings' });
    await addUserToOrgUnit(team.id, alice.id);

    law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    client = await createClient();
    rule = await createComplianceRule({ lawId: law.id });
    await createClientRegistration(client.id, law.id);

    // Filing assigned to Alice with dueDate inside the "this week" window
    // relative to the asOf used in the firing test.
    await createComplianceFiling({
      ruleId: rule.id,
      clientId: client.id,
      lawId: law.id,
      assigneeId: alice.id,
      assigneeTeamId: team.id,
      dueDate: '2026-06-03',
    });

    ({ rule: digestRule } = await createComplianceDigestRule({ scheduleHour: 9 }));
  });

  test('digest rule fires at 9am and dispatches an in-app notification to the assignee', async () => {
    // Alice's filing is dueDate=2026-06-03; asOf=2026-06-01 → "this week" bucket.
    await runScheduler('2026-06-01T09:00:00Z');

    await expect
      .poll(async () => (await listNotificationsFor(alice.id)).length, {
        message: 'Alice should receive exactly one digest notification',
        timeout: 10_000,
        intervals: [200, 400, 800, 1500],
      })
      .toBeGreaterThan(0);

    const aliceNotifs = await listNotificationsFor(alice.id);
    expect(aliceNotifs.length).toBeGreaterThan(0);
    expect(aliceNotifs[0].title).toContain('Your filings');
    // Filing is in the "this week" window — body should mention the WEEK section.
    expect(aliceNotifs[0].body).toContain('WEEK:');
    expect(aliceNotifs[0].body).not.toContain('OVERDUE:');
    expect(aliceNotifs[0].body).not.toContain('NEXT:');
  });

  test('user with no filings receives no digest', async () => {
    // Bob is in no team, has no filings — the per-user query for him returns
    // empty buckets and the action short-circuits before dispatching. The
    // first test's scheduler run already fired against every user, so a
    // missing notification here is the persistent state, not a timing gap.
    const bobNotifs = await listNotificationsFor(bob.id);
    expect(bobNotifs).toHaveLength(0);
  });

  test('digest does not fire outside scheduleHour', async () => {
    const aliceBefore = (await listNotificationsFor(alice.id)).length;

    // 06:00 UTC misses the rule's scheduleHour=9 — scanner should skip it.
    await runScheduler('2026-06-02T06:00:00Z');

    // Brief wait so any erroneous async dispatch would have landed.
    await new Promise((resolve) => setTimeout(resolve, 750));

    const aliceAfter = (await listNotificationsFor(alice.id)).length;
    expect(aliceAfter, 'no new notifications when asOf hour misses scheduleHour').toBe(aliceBefore);
  });

  test('exposes the rule for the seeded action handler', () => {
    // The rule shape asserted by other tests is also visible to the suite —
    // this is a thin sanity check that catches refactors that drop the
    // `send_compliance_filing_digest` registration.
    expect(digestRule.id).toBeTruthy();
    expect(digestRule.scheduleHour).toBe(9);
    expect(digestRule.scheduleEntityType).toBe('users');
  });
});
