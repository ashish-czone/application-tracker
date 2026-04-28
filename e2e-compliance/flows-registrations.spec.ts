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
  // Each test creates its own team + handler against the system-seeded GST law.
  // Without a per-test reset, handler rows accumulate across tests; the
  // I19 resolver treats two global-primary handlers for the same law as
  // ambiguous, which surfaces as NO_RESOLVABLE_ASSIGNEE on subsequent
  // registration creates. `reset-state.ts` documents this exact pattern.
  test.beforeEach(async () => {
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
    // Pin registration's effectiveFrom in the past so generator runs with
    // past asOf (below) see the registration as active. Date literals here
    // must all be past-or-today — `deactivatedAt` is validated as such.
    await createClientRegistration(client.id, law.id, { effectiveFrom: '2025-01-01' });

    // First sweep: rolling-12-month materialisation as of 2025-04-15
    // produces filings whose periodStart spans roughly 2025-04 through
    // 2026-03 (12-month horizon).
    await runGenerator('2025-04-15T02:00:00Z');
    const beforeDeactivation = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const ourBefore = beforeDeactivation.data.filter(
      (f) => f.clientId === client.id && f.ruleId === rule.id,
    );
    expect(ourBefore.length, 'horizon should produce multiple filings').toBeGreaterThan(0);

    const periodStartsBefore = new Set(ourBefore.map((f) => f.periodStart));

    // Deactivate at end of June 2025. Implementation uses strict
    // `periodStart > deactivatedAt` for auto-cancellation, so picking a date
    // BETWEEN periods (not on a period boundary) keeps the test intent clear:
    // June period stays active (it started <= cutoff), July onwards are
    // cancelled. Past filings (period <= 2025-06-30) remain non-terminal.
    await deactivateRegistration(client.id, law.id, {
      deactivatedAt: '2025-06-30',
    });

    // Subsequent generator run at a later asOf — horizon would normally
    // advance the materialisation forward. With the registration
    // deactivated, no new filings should be added for post-cutoff periods.
    await runGenerator('2025-08-15T02:00:00Z');
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

    // No new non-terminal post-cutoff filings. Pre-existing post-cutoff
    // filings from the first sweep are cancelled by deactivation (terminal),
    // which is the correct outcome — they're no longer actionable. Filter
    // those out; what we're asserting is "the second sweep didn't materialise
    // any fresh, actionable filings for periods after the cutoff".
    const postCutoff = ourAfter.filter(
      (f) => f.periodStart > '2025-06-30' && f.status !== 'cancelled',
    );
    expect(
      postCutoff,
      'no filings should generate for periods after deactivatedAt',
    ).toHaveLength(0);
  });
});
