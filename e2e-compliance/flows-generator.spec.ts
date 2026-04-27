import { test, expect } from './fixtures/auth';
import { resetState, apiClient } from './helpers';
import { createClient, type CreatedClient } from './fixtures/clients';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule, type ComplianceRule } from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { runGenerator } from './fixtures/cron';

interface FilingRow {
  id: string;
  ruleId: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
}

/**
 * Generator user stories — US-6.1, US-6.2, US-6.3.
 *
 * Each test runs the generator at a deterministic asOf via the test-hooks
 * cron endpoint and asserts shape of the resulting compliance_filings rows.
 * The chain (team / law / client / rule / registration) is built once in
 * beforeAll without a pre-existing filing so the generator is the only
 * source of filings under test.
 */
test.describe('Flow: filings generator (US-6.x)', () => {
  let team: OrgUnit;
  let law: Law;
  let client: CreatedClient;
  let rule: ComplianceRule;

  test.beforeAll(async () => {
    await resetState();
    team = await createOrgUnit({ level: 'Team' });
    law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    client = await createClient();
    rule = await createComplianceRule({
      lawId: law.id,
      frequency: 'monthly',
      dueDayOfMonth: 20,
      dueMonthOffset: 1,
    });
    await createClientRegistration(client.id, law.id);
  });

  test('US-6.1 generator emits filings for active rule × registered client', async () => {
    const result = await runGenerator(new Date());
    expect(result.created, 'generator should create at least one filing').toBeGreaterThan(0);

    // Assert the join shape: at least one filing for our (rule, client) pair.
    const filings = await apiClient.get<{ data: FilingRow[] }>('/compliance-filings', {
      query: { limit: 200 },
    });
    const ours = filings.data.filter((f) => f.ruleId === rule.id && f.clientId === client.id);
    expect(ours.length, 'expected at least one filing for fixture (rule, client)').toBeGreaterThan(0);
  });

  test('US-6.2 generator emits filings only within the rolling 12-month horizon', async () => {
    // Pin asOf to a fixed date so the horizon math is deterministic regardless
    // of when the suite runs.
    const asOf = new Date('2026-06-15T00:00:00Z');
    await runGenerator(asOf);

    const filings = await apiClient.get<{ data: FilingRow[] }>('/compliance-filings', {
      query: { limit: 1000 },
    });
    const ours = filings.data.filter((f) => f.ruleId === rule.id && f.clientId === client.id);
    expect(ours.length, 'expected filings for (rule, client) within horizon').toBeGreaterThan(0);

    // Horizon end is asOf + 12 months. Every filing's periodStart must be on
    // or before that date.
    const horizonEnd = new Date(asOf);
    horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + 12);
    const horizonEndIso = horizonEnd.toISOString().slice(0, 10);

    for (const f of ours) {
      expect(
        f.periodStart <= horizonEndIso,
        `filing ${f.id} periodStart=${f.periodStart} should be <= ${horizonEndIso}`,
      ).toBe(true);
    }
  });

  test('US-6.3 generator endpoint is idempotent on re-run with the same asOf', async () => {
    const asOf = new Date('2026-08-01T00:00:00Z');

    // First run materialises whatever isn't already there.
    const first = await runGenerator(asOf);

    // Second run with the same asOf must be a no-op — the per-occurrence
    // findByRuleClientPeriod guard skips existing rows.
    const second = await runGenerator(asOf);
    expect(second.created, 're-running with the same asOf should create 0 new rows').toBe(0);

    // Sanity: the row count for our pair is stable across the second call.
    const filings = await apiClient.get<{ data: FilingRow[] }>('/compliance-filings', {
      query: { limit: 1000 },
    });
    const ours = filings.data.filter((f) => f.ruleId === rule.id && f.clientId === client.id);
    expect(ours.length, 'idempotent generator preserves row count').toBeGreaterThanOrEqual(first.created);
  });
});
