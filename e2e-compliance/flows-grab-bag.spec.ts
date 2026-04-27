import { test, expect } from './fixtures/auth';
import { resetState, apiClient, listNotificationsFor } from './helpers';
import { createClient, type CreatedClient } from './fixtures/clients';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import {
  createComplianceRule,
  transitionComplianceRule,
} from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { createComplianceFiling, type ComplianceFiling } from './fixtures/filings';
import { createUser, type CreatedUser } from './fixtures/users';
import {
  createComplianceDigestRule,
  createComplianceEscalationRule,
} from './fixtures/automation-rules';
import { runScheduler } from './fixtures/cron';

interface FilingRow {
  id: string;
  ruleId: string;
  clientId: string;
  assigneeId: string | null;
  assigneeTeamId: string;
}

/**
 * Grab-bag of named coverage that doesn't fit a larger PR by itself:
 *
 *   US-6.4 Generator triggered by registration / rule activation —
 *          listener-driven top-up so admins don't wait for the nightly
 *          cron. Two sub-cases (rule activate, registration create).
 *   US-8.3 Due-soon visibility — a filing whose dueDate falls inside
 *          the next 7 days is rendered in the digest's "this week"
 *          section. (Effectively a re-cut of part of US-8.1's named
 *          test, with the assertion narrowed to the section boundary.)
 *   US-11.2 Escalation adds visibility, never reassigns — the schedule
 *          scanner firing T+0 / T+3 / T+7 doesn't mutate the filing's
 *          assigneeId or assigneeTeamId.
 */
test.describe('Flow: grab-bag (US-6.4 / US-8.3 / US-11.2)', () => {
  test.beforeAll(async () => {
    await resetState();
  });

  test('US-6.4 activating a draft rule emits filings immediately', async () => {
    const team = await createOrgUnit({ level: 'Team', name: 'TeamForRuleActivation' });
    const law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    const client = await createClient();
    await createClientRegistration(client.id, law.id);
    const rule = await createComplianceRule({ lawId: law.id, status: 'draft' });

    // Pre-condition: no filings yet.
    const before = await apiClient.get<{ data: FilingRow[] }>(
      `/compliance-filings?limit=200`,
    );
    expect(
      before.data.filter((f) => f.ruleId === rule.id),
      'draft rule should produce no filings before activation',
    ).toHaveLength(0);

    // Activate via the workflow transition. The listener picks up
    // compliance-rules.StatusChanged and runs the generator inline.
    await transitionComplianceRule(rule.id, 'active');

    await expect
      .poll(async () => {
        const all = await apiClient.get<{ data: FilingRow[] }>(
          `/compliance-filings?limit=200`,
        );
        return all.data.filter((f) => f.ruleId === rule.id).length;
      }, { timeout: 5_000, intervals: [200, 400, 800] })
      .toBeGreaterThan(0);
  });

  test('US-6.4 registering a client emits filings immediately', async () => {
    const team = await createOrgUnit({ level: 'Team', name: 'TeamForReg' });
    const law = await getSystemLaw('ITR');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    const rule = await createComplianceRule({ lawId: law.id, status: 'active' });
    const client = await createClient();

    // No registration yet → no filings.
    const before = await apiClient.get<{ data: FilingRow[] }>(
      `/compliance-filings?limit=200`,
    );
    expect(
      before.data.filter((f) => f.ruleId === rule.id && f.clientId === client.id),
      'no filings before registration',
    ).toHaveLength(0);

    await createClientRegistration(client.id, law.id);

    await expect
      .poll(async () => {
        const all = await apiClient.get<{ data: FilingRow[] }>(
          `/compliance-filings?limit=200`,
        );
        return all.data.filter(
          (f) => f.ruleId === rule.id && f.clientId === client.id,
        ).length;
      }, { timeout: 5_000, intervals: [200, 400, 800] })
      .toBeGreaterThan(0);
  });

  test('US-8.3 a filing due within 7 days appears in the digest "this week" section', async () => {
    const team = await createOrgUnit({ level: 'Team', name: 'DigestTeam' });
    const law = await getSystemLaw('TDS');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    const rule = await createComplianceRule({ lawId: law.id });
    const client = await createClient();
    await createClientRegistration(client.id, law.id);

    const alice = await createUser({ firstName: 'AliceDS', lastName: 'DueSoon' });
    await createComplianceFiling({
      ruleId: rule.id,
      clientId: client.id,
      lawId: law.id,
      assigneeTeamId: team.id,
      assigneeId: alice.id,
      dueDate: '2026-09-05', // 4 days after the asOf below
    });

    await createComplianceDigestRule({ scheduleHour: 9 });

    // asOf 2026-09-01T09 → dueDate 2026-09-05 falls within the
    // [today, today+7] "this week" window per US-8.3.
    await runScheduler('2026-09-01T09:00:00Z');

    await expect
      .poll(async () => (await listNotificationsFor(alice.id)).length, {
        timeout: 10_000,
        intervals: [200, 400, 800, 1500],
      })
      .toBeGreaterThan(0);

    const notifs = await listNotificationsFor(alice.id);
    const digest = notifs[0];
    expect(digest.body).toContain('WEEK');
    expect(digest.body).not.toContain('OVERDUE');
    expect(digest.body).not.toContain('NEXT');
  });

  test('US-11.2 escalation firing does not modify the filing\'s assignee or team', async () => {
    const team = await createOrgUnit({ level: 'Team', name: 'EscNoReassign' });
    const law = await getSystemLaw('ROC');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    const rule = await createComplianceRule({ lawId: law.id });
    const client = await createClient();
    await createClientRegistration(client.id, law.id);

    const carol = await createUser({ firstName: 'CarolNR', lastName: 'StillAssigned' });

    const filing = await createComplianceFiling({
      ruleId: rule.id,
      clientId: client.id,
      lawId: law.id,
      assigneeTeamId: team.id,
      assigneeId: carol.id,
      dueDate: '2026-10-01',
    });

    // T+0 escalation rule whose action would normally notify the assignee.
    await createComplianceEscalationRule({
      dayOffset: 0,
      recipientStrategy: 'entity_field',
      conditions: [
        { field: 'status', operator: 'neq', value: 'completed' },
        { field: 'status', operator: 'neq', value: 'cancelled' },
        { field: 'assigneeId', operator: 'is_not_null' },
      ],
    });

    // Fire the scheduler at the filing's due date. The rule matches and
    // its action enqueues a notification — but the filing itself must
    // be untouched (visibility-only contract).
    await runScheduler('2026-10-01T02:00:00Z');

    // Settle: give the worker a moment to drain (escalation dispatches
    // are async; the assertion below checks the filing row, which is
    // never modified by a notification path even on async dispatch).
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    interface FilingDetail {
      assigneeId: string | null;
      assigneeTeamId: string;
    }
    const refetched = await apiClient.get<FilingDetail>(`/compliance-filings/${filing.id}`);
    expect(refetched.assigneeId, 'assignee unchanged after escalation').toBe(carol.id);
    expect(refetched.assigneeTeamId, 'team unchanged after escalation').toBe(team.id);
  });
});
