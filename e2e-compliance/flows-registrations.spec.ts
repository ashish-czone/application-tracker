import { test, expect } from './fixtures/auth';
import { resetState, apiClient } from './helpers';
import { createClient } from './fixtures/clients';
import { deactivateRegistration } from './fixtures/clients';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule } from './fixtures/rules';
import { createClientRegistration, getClientRegistration } from './fixtures/registrations';
import { runGenerator } from './fixtures/cron';

interface FilingRow {
  id: string;
  ruleId: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
}

/**
 * §2 client registrations — named coverage:
 *
 *   US-2.2 Reject registration without a resolvable handler (I20/I21)
 *   US-2.3 Capture registration metadata (registrationNumber, effectiveFrom)
 *   US-2.4 Deactivate registration (forward-only) — past filings preserved,
 *          no new filings for periods after `deactivatedAt`
 *
 * US-2.1 (register) is covered as a precondition by every other compliance
 * spec via `createClientRegistration`.
 */
test.describe('Flow: client registrations (US-2.x)', () => {
  test.beforeAll(async () => {
    await resetState();
  });

  test('US-2.2 registration is rejected when the law has no handler configured', async () => {
    const law = await getSystemLaw('GST'); // system-seeded — no handler created here
    const client = await createClient();

    // No createLawHandler() call → I20 guard should reject.
    let rejected = false;
    try {
      await createClientRegistration(client.id, law.id);
    } catch (err) {
      rejected = true;
      expect((err as Error).message).toMatch(/4\d\d|handler|no .*handler|I20|I21/i);
    }
    expect(rejected, 'registration without handler must be rejected').toBe(true);
  });

  test('US-2.3 registration captures registrationNumber and effectiveFrom metadata', async () => {
    const team = await createOrgUnit({ level: 'Team' });
    const law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    const client = await createClient();

    const registrationNumber = 'GSTIN-29ABCDE1234F1Z5';
    const effectiveFrom = '2026-01-15';
    const created = await createClientRegistration(client.id, law.id, {
      registrationNumber,
      effectiveFrom,
    });

    expect(created.registrationNumber).toBe(registrationNumber);
    expect(created.effectiveFrom).toBe(effectiveFrom);

    // Round-trip via GET — confirms the columns persist, not just echo on POST.
    const fetched = await getClientRegistration(created.id);
    expect(fetched.registrationNumber).toBe(registrationNumber);
    expect(fetched.effectiveFrom).toBe(effectiveFrom);
  });

  test('US-2.3 effectiveFrom defaults to today when omitted on create', async () => {
    const team = await createOrgUnit({ level: 'Team' });
    const law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    const client = await createClient();

    const created = await createClientRegistration(client.id, law.id);

    // YYYY-MM-DD shape; we don't pin the exact day to avoid timezone-edge
    // flakes around midnight. Default-today is the contract; the regex
    // confirms we got a calendar date, not null.
    expect(created.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(created.registrationNumber).toBeNull();
  });

  test('US-2.4 deactivating a registration is forward-only', async () => {
    const team = await createOrgUnit({ level: 'Team' });
    const law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    const client = await createClient();
    const rule = await createComplianceRule({ lawId: law.id });
    await createClientRegistration(client.id, law.id);

    // First sweep: rolling-12-month materialisation as of 2026-04-15
    // produces filings whose periodStart spans roughly 2026-04 through
    // 2027-03 (12-month horizon).
    await runGenerator('2026-04-15T02:00:00Z');
    const beforeDeactivation = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const ourBefore = beforeDeactivation.data.filter(
      (f) => f.clientId === client.id && f.ruleId === rule.id,
    );
    expect(ourBefore.length, 'horizon should produce multiple filings').toBeGreaterThan(0);

    const periodStartsBefore = new Set(ourBefore.map((f) => f.periodStart));

    // Deactivate as of 2026-07-01. Past filings (period < 2026-07-01)
    // remain non-terminal; no new filings should be emitted for periods
    // starting 2026-07-01 or later on subsequent generator runs.
    await deactivateRegistration(client.id, law.id, {
      deactivatedAt: '2026-07-01',
    });

    // Subsequent generator run at a later asOf — horizon would normally
    // advance the materialisation forward. With the registration
    // deactivated, no new filings should be added for post-cutoff periods.
    await runGenerator('2026-08-15T02:00:00Z');
    const afterDeactivation = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const ourAfter = afterDeactivation.data.filter(
      (f) => f.clientId === client.id && f.ruleId === rule.id,
    );

    // Past filings preserved.
    for (const periodStart of periodStartsBefore) {
      expect(
        ourAfter.some((f) => f.periodStart === periodStart),
        `pre-deactivation filing for period ${periodStart} must survive`,
      ).toBe(true);
    }

    // No new post-cutoff filings.
    const postCutoff = ourAfter.filter((f) => f.periodStart >= '2026-07-01');
    expect(
      postCutoff,
      'no filings should generate for periods after deactivatedAt',
    ).toHaveLength(0);
  });
});
