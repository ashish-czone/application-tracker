import { test, expect } from './fixtures/auth';
import { resetState } from './helpers';
import { createClient, type CreatedClient } from './fixtures/clients';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule, type ComplianceRule } from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { createComplianceFiling, type ComplianceFiling } from './fixtures/filings';
import { createScheduleRule, type ScheduleRule } from './fixtures/automation-rules';
import { runScheduler } from './fixtures/cron';

/**
 * Schedule scanner platform proof — covers the machinery US-8.1 (daily
 * digest) and US-8.2 (T+0/T+3/T+7 escalation) share. A custom
 * schedule_recurring rule is created against compliance-filings and
 * fired at a deterministic asOf; we assert the rule emits a row in
 * automation_sent_log for the matching filing.
 *
 * The user-facing escalation/digest rules (Stream B / Stream D) are
 * configured by the firm admin in V1 — not platform-seeded — so we
 * verify the platform mechanism here. The specific rule shapes for
 * digest and escalation are integration-tested at the action-handler
 * unit level.
 *
 * Assumes APP_TIMEZONE=UTC (the default). If the API runs with a
 * different APP_TIMEZONE the hour assertions need to be adjusted to
 * the corresponding UTC instant.
 */
test.describe('Flow: schedule scanner (US-8.x platform proof)', () => {
  let team: OrgUnit;
  let law: Law;
  let client: CreatedClient;
  let rule: ComplianceRule;
  let filing: ComplianceFiling;
  let scheduleRule: ScheduleRule;

  test.beforeAll(async () => {
    await resetState();
    team = await createOrgUnit({ level: 'Team' });
    law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    client = await createClient();
    rule = await createComplianceRule({ lawId: law.id });
    await createClientRegistration(client.id, law.id);
    filing = await createComplianceFiling({
      ruleId: rule.id,
      clientId: client.id,
      lawId: law.id,
      assigneeTeamId: team.id,
      dueDate: '2026-06-01',
    });

    // schedule_recurring rule: fires at hour 5 (UTC), matches any
    // compliance-filing whose dueDate has elapsed by asOf.
    scheduleRule = await createScheduleRule({
      scheduleEntityType: 'compliance-filings',
      scheduleHour: 5,
      scheduleDateField: 'dueDate',
      scheduleDateOperator: 'after',
      scheduleDateAmounts: [0],
      scheduleDateUnit: 'days',
    });
  });

  test('rule fires for matching entity when asOf hour matches scheduleHour', async () => {
    const result = await runScheduler('2026-06-01T05:00:00Z');

    const ours = result.fired.filter((f) => f.ruleId === scheduleRule.id);
    expect(ours.length, 'schedule rule should have fired at least once').toBeGreaterThan(0);
    expect(
      ours.find((f) => f.entityId === filing.id),
      'fixture filing should appear in fired list',
    ).toBeTruthy();
  });

  test('rule does NOT fire when asOf hour misses scheduleHour', async () => {
    // Scan at 06:00 UTC — scheduleHour is 5, so the rule must skip.
    const result = await runScheduler('2026-06-02T06:00:00Z');
    const ours = result.fired.filter((f) => f.ruleId === scheduleRule.id);
    expect(ours.length, 'rule should not fire outside its scheduleHour').toBe(0);
  });

  test('idempotent re-run at the same asOf produces no additional rows', async () => {
    // First scan at a fresh date — rule fires and writes to sent_log.
    const first = await runScheduler('2026-06-03T05:00:00Z');
    const firstFire = first.fired.find(
      (f) => f.ruleId === scheduleRule.id && f.entityId === filing.id,
    );
    expect(firstFire, 'first run should fire for fixture filing').toBeTruthy();

    // Second scan at the same asOf — sent_log dedup index blocks re-fire.
    const second = await runScheduler('2026-06-03T05:00:00Z');
    const secondFire = second.fired.find(
      (f) => f.ruleId === scheduleRule.id && f.entityId === filing.id,
    );
    expect(secondFire, 're-running at the same asOf must not refire the rule').toBeFalsy();
  });
});
