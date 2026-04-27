import { test, expect } from './fixtures/auth';
import { resetState, listNotificationsFor } from './helpers';
import { createClient, type CreatedClient } from './fixtures/clients';
import {
  addUserToOrgUnit,
  createOrgUnit,
  getOrgPosition,
  type OrgUnit,
} from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule, type ComplianceRule } from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { createComplianceFiling, type ComplianceFiling } from './fixtures/filings';
import { createUser, type CreatedUser } from './fixtures/users';
import { createComplianceEscalationRule } from './fixtures/automation-rules';
import { runScheduler } from './fixtures/cron';

/**
 * US-8.2 overdue escalation T+0 / T+3 / T+7 — named coverage.
 *
 * Builds three `schedule_once` rules equivalent to the seeded
 * `compliance-filing-overdue-tier-{1-assignee, 2, 3}` set, each with an
 * in-app channel added so the test-hooks notification endpoint can
 * observe dispatch:
 *
 *   T+0 → entity_field(assigneeId)        — Alice
 *   T+3 → org_unit_head(assigneeTeamId)   — Bob (head of child team)
 *   T+7 → parent_unit_head(assigneeTeamId)— Carol (head of parent team)
 *
 * `schedule_once` dedup is per (rule, entity) — once a tier fires for the
 * filing, it never refires. Escalating to the next tier requires a
 * separate rule, which is why each tier is registered independently.
 *
 * Tests run in serial order. State accumulates: Alice receives at T+0,
 * later asserts that Bob was empty at T+0 confirm cross-tier isolation.
 *
 * Schedule scanner default scheduleHour is 2 (UTC) — the asOfs use 02:00
 * to clear the hour gate.
 */
test.describe('Flow: compliance overdue escalation (US-8.2)', () => {
  let parentTeam: OrgUnit;
  let childTeam: OrgUnit;
  let alice: CreatedUser; // assignee
  let bob: CreatedUser;   // head of child team
  let carol: CreatedUser; // head of parent team
  let law: Law;
  let client: CreatedClient;
  let rule: ComplianceRule;
  let filing: ComplianceFiling;

  test.beforeAll(async () => {
    await resetState();

    const headPosition = await getOrgPosition('Head');

    parentTeam = await createOrgUnit({ level: 'Division' });
    childTeam = await createOrgUnit({ level: 'Team', parentId: parentTeam.id });

    alice = await createUser({ firstName: 'Alice', lastName: 'Assignee' });
    bob = await createUser({ firstName: 'Bob', lastName: 'TeamHead' });
    carol = await createUser({ firstName: 'Carol', lastName: 'ParentHead' });

    // Alice as a positionless member — org_unit_head resolver excludes
    // members without a position (see ParentUnitHeadStrategy:69).
    await addUserToOrgUnit(childTeam.id, alice.id);
    await addUserToOrgUnit(childTeam.id, bob.id, { positionId: headPosition.id });
    await addUserToOrgUnit(parentTeam.id, carol.id, { positionId: headPosition.id });

    law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: childTeam.id });
    client = await createClient();
    rule = await createComplianceRule({ lawId: law.id });
    await createClientRegistration(client.id, law.id);

    filing = await createComplianceFiling({
      ruleId: rule.id,
      clientId: client.id,
      lawId: law.id,
      assigneeId: alice.id,
      assigneeTeamId: childTeam.id,
      dueDate: '2026-06-01',
    });

    await createComplianceEscalationRule({
      dayOffset: 0,
      recipientStrategy: 'entity_field',
      conditions: [
        { field: 'status', operator: 'neq', value: 'completed' },
        { field: 'status', operator: 'neq', value: 'cancelled' },
        { field: 'assigneeId', operator: 'is_not_null' },
      ],
    });
    await createComplianceEscalationRule({
      dayOffset: 3,
      recipientStrategy: 'org_unit_head',
    });
    await createComplianceEscalationRule({
      dayOffset: 7,
      recipientStrategy: 'parent_unit_head',
    });
  });

  test('T+0 dispatches to direct assignee, not to team or parent heads', async () => {
    // dueDate = 2026-06-01, asOf = 2026-06-01 02:00 UTC →
    //   T+0 (dueDate + 0 days = today) MATCHES
    //   T+3 (dueDate + 3 days = 2026-06-04) does not match
    //   T+7 (dueDate + 7 days = 2026-06-08) does not match
    await runScheduler('2026-06-01T02:00:00Z');

    await expect
      .poll(async () => (await listNotificationsFor(alice.id)).length, {
        message: 'Alice should receive a T+0 notification',
        timeout: 10_000,
        intervals: [200, 400, 800, 1500],
      })
      .toBeGreaterThan(0);

    const aliceNotifs = await listNotificationsFor(alice.id);
    expect(aliceNotifs.length).toBeGreaterThan(0);
    expect(aliceNotifs.some((n) => n.title.startsWith('Filing overdue'))).toBe(true);
    expect(aliceNotifs[0].entityType).toBe('compliance-filings');
    expect(aliceNotifs[0].entityId).toBe(filing.id);

    expect(await listNotificationsFor(bob.id), 'Bob is not notified at T+0').toHaveLength(0);
    expect(await listNotificationsFor(carol.id), 'Carol is not notified at T+0').toHaveLength(0);
  });

  test('T+3 dispatches to team head, not parent head', async () => {
    // asOf = 2026-06-04 02:00 UTC →
    //   T+0 already fired (dedup), and 2026-06-01 + 0 != 2026-06-04 anyway
    //   T+3 (2026-06-01 + 3 = 2026-06-04) MATCHES
    //   T+7 (2026-06-01 + 7 = 2026-06-08) does not match
    await runScheduler('2026-06-04T02:00:00Z');

    await expect
      .poll(async () => (await listNotificationsFor(bob.id)).length, {
        message: 'Bob (team head) should receive a T+3 notification',
        timeout: 10_000,
        intervals: [200, 400, 800, 1500],
      })
      .toBeGreaterThan(0);

    expect(await listNotificationsFor(carol.id), 'Carol is not notified at T+3').toHaveLength(0);
  });

  test('T+7 dispatches to parent unit head', async () => {
    // asOf = 2026-06-08 02:00 UTC →
    //   T+7 MATCHES; earlier tiers deduped from prior fires.
    await runScheduler('2026-06-08T02:00:00Z');

    await expect
      .poll(async () => (await listNotificationsFor(carol.id)).length, {
        message: 'Carol (parent unit head) should receive a T+7 notification',
        timeout: 10_000,
        intervals: [200, 400, 800, 1500],
      })
      .toBeGreaterThan(0);
  });

  test('idempotent: re-running the scheduler at the same asOf does not refire any tier', async () => {
    const before = {
      alice: (await listNotificationsFor(alice.id)).length,
      bob: (await listNotificationsFor(bob.id)).length,
      carol: (await listNotificationsFor(carol.id)).length,
    };

    // Re-run every asOf used above. Each tier is deduped via
    // automation_sent_log on (ruleId, entity, targetDate='9999-12-31').
    await runScheduler('2026-06-01T02:00:00Z');
    await runScheduler('2026-06-04T02:00:00Z');
    await runScheduler('2026-06-08T02:00:00Z');

    // Brief settle window so any erroneous async dispatch lands.
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    const after = {
      alice: (await listNotificationsFor(alice.id)).length,
      bob: (await listNotificationsFor(bob.id)).length,
      carol: (await listNotificationsFor(carol.id)).length,
    };

    expect(after).toEqual(before);
  });
});
