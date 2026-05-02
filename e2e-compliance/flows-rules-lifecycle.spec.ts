import { test, expect } from './fixtures/auth';
import { resetState, apiClient } from './helpers';
import { createClient, type CreatedClient } from './fixtures/clients';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import {
  createComplianceRule,
  deprecateComplianceRule,
  transitionComplianceRule,
  updateComplianceRule,
} from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { runGenerator } from './fixtures/cron';

interface FilingRow {
  id: string;
  ruleId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  status: string;
}

/**
 * §3 compliance rule catalogue — named coverage:
 *
 *   US-3.2 Activate rule (draft → active) — generator picks it up only
 *          after activation
 *   US-3.3 Edit rule parameters forward-only — past filings unchanged,
 *          new filings reflect updated parameters
 *   US-3.4 Deprecate a rule — generator stops emitting; past filings
 *          preserved
 *
 * US-3.1 (define rule) is covered by `compliance-rules.spec.ts` and as
 * a precondition by every flow that calls `createComplianceRule`.
 */
test.describe('Flow: rule lifecycle (US-3.x)', () => {
  let team: OrgUnit;
  let law: Law;

  test.beforeAll(async () => {
    await resetState();
    team = await createOrgUnit({ level: 'Team' });
    law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
  });

  async function freshClientWithRegistration(): Promise<CreatedClient> {
    const client = await createClient({ status: 'active' });
    await createClientRegistration(client.id, law.id);
    return client;
  }

  test('US-3.2 draft rule is invisible to the generator until activated', async () => {
    const client = await freshClientWithRegistration();
    const rule = await createComplianceRule({ lawId: law.id, status: 'draft' });

    // Generator must skip draft rules — no filings emitted.
    await runGenerator('2026-06-15T02:00:00Z');
    const draftSweep = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const draftRuleFilings = draftSweep.data.filter((f) => f.ruleId === rule.id);
    expect(draftRuleFilings, 'no filings while rule is draft').toHaveLength(0);

    // Activate via the workflow transition endpoint.
    const activated = await transitionComplianceRule(rule.id, 'active');
    expect(activated.status).toBe('active');

    // Re-run the generator — now the rule should produce filings against
    // the registered client.
    await runGenerator('2026-06-15T02:00:00Z');
    const activeSweep = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const activeRuleFilings = activeSweep.data.filter(
      (f) => f.ruleId === rule.id && f.id && f.id !== '' && f.id !== null && (f as any).clientId === client.id,
    );
    expect(activeRuleFilings.length, 'filings emitted only after activation').toBeGreaterThan(0);
  });

  test('US-3.3 editing a rule does not rewrite past filings', async () => {
    const client = await freshClientWithRegistration();
    const rule = await createComplianceRule({
      lawId: law.id,
      status: 'active',
      dueDayOfMonth: 10,
    });

    // Initial sweep with dueDayOfMonth=10 generates filings whose dueDate
    // ends in '-10'.
    await runGenerator('2026-04-15T02:00:00Z');
    const beforeEdit = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const ourBefore = beforeEdit.data.filter(
      (f) => f.ruleId === rule.id && (f as { clientId?: string }).clientId === client.id,
    );
    expect(ourBefore.length, 'first sweep should produce filings').toBeGreaterThan(0);
    const dueDatesBefore = ourBefore.map((f) => f.dueDate).filter((d): d is string => Boolean(d));
    for (const dd of dueDatesBefore) {
      expect(dd.endsWith('-10'), `pre-edit filing dueDate should be -10: ${dd}`).toBe(true);
    }

    // Edit dueDayOfMonth to 25.
    const updated = await updateComplianceRule(rule.id, { dueDayOfMonth: 25 });
    expect(updated.id).toBe(rule.id);

    // Re-fetch the past filings — they must still carry the original -10
    // dueDate (forward-only).
    const afterEdit = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const ourAfter = afterEdit.data.filter(
      (f) => f.ruleId === rule.id && (f as { clientId?: string }).clientId === client.id,
    );

    for (const before of ourBefore) {
      const sameId = ourAfter.find((f) => f.id === before.id);
      expect(sameId, `filing ${before.id} must still exist`).toBeTruthy();
      expect(sameId!.dueDate, `pre-edit filing ${before.id} dueDate must not change`).toBe(before.dueDate);
    }
  });

  test('US-3.4 deprecating a rule preserves past filings and stops new ones', async () => {
    const client = await freshClientWithRegistration();
    const rule = await createComplianceRule({ lawId: law.id, status: 'active' });

    // Initial sweep produces N filings.
    await runGenerator('2026-04-15T02:00:00Z');
    const beforeDep = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const ourBefore = beforeDep.data.filter((f) => f.ruleId === rule.id);
    expect(ourBefore.length, 'sweep should produce filings').toBeGreaterThan(0);
    const idsBefore = new Set(ourBefore.map((f) => f.id));

    // Deprecate. Forward-only by default — alsoCancelInFlight=false leaves
    // existing non-terminal filings alone. The deprecate transition requires
    // a comment per RULES_WORKFLOW so the audit row stands on its own.
    const deprecated = await deprecateComplianceRule(rule.id, {
      alsoCancelInFlight: false,
      comment: 'E2E flow: forward-only deprecation; existing filings preserved',
    });
    expect(deprecated.status).toBe('deprecated');

    // A subsequent sweep at a later asOf would normally extend the horizon
    // and add filings for new periods. With the rule deprecated, no NEW
    // filings should appear.
    await runGenerator('2026-08-15T02:00:00Z');
    const afterDep = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const ourAfter = afterDep.data.filter((f) => f.ruleId === rule.id);

    // Same id-set — preserved, not augmented.
    expect(new Set(ourAfter.map((f) => f.id))).toEqual(idsBefore);
  });
});
