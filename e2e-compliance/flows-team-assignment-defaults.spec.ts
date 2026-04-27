import { test, expect } from './fixtures/auth';
import { resetState, apiClient } from './helpers';
import { createClient, type CreatedClient } from './fixtures/clients';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule } from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { runGenerator } from './fixtures/cron';

interface FilingRow {
  id: string;
  ruleId: string;
  clientId: string;
  assigneeTeamId: string | null;
}

/**
 * §5 default team assignment — named coverage.
 *
 * Note: V1 implements team-assignment-by-default at the **law-handler**
 * level, not the rule level. `compliance_rules` has no `defaultTeamId`
 * column — instead, the generator's `resolveAssignee(lawId, clientId)`
 * walks `compliance_law_handlers` and picks (a) the client-specific
 * handler if one exists, otherwise (b) the law's primary handler. The
 * spec.md wording ("default team for a rule") will need to either get
 * a follow-up to add `rule.defaultTeamId`, or be reworded to say
 * "default team for a law's filings". The behavior US-5.x asks for is
 * fully implemented today — this test asserts that.
 *
 *   US-5.1 Set the default team for a rule — verified at the law level:
 *          a primary law-handler dictates assigneeTeamId on every
 *          filing the generator emits for that law.
 *   US-5.2 Override default team per client — a law-handler row with
 *          `clientId` set wins over the primary handler for that
 *          client's filings.
 */
test.describe('Flow: team-assignment defaults (US-5.x)', () => {
  let defaultTeam: OrgUnit;
  let overrideTeam: OrgUnit;
  let law: Law;
  let rule: { id: string };
  let primaryClient: CreatedClient;
  let overrideClient: CreatedClient;

  test.beforeAll(async () => {
    await resetState();

    defaultTeam = await createOrgUnit({ level: 'Team', name: 'DefaultTeam' });
    overrideTeam = await createOrgUnit({ level: 'Team', name: 'OverrideTeam' });

    law = await getSystemLaw('GST');

    // Primary law-handler — the default team for any filing under this
    // law. Required before any client can register against the law.
    await createLawHandler({
      lawId: law.id,
      orgEntityId: defaultTeam.id,
      isPrimary: true,
    });

    rule = await createComplianceRule({ lawId: law.id, status: 'active' });

    primaryClient = await createClient({ name: 'PrimaryClient' });
    overrideClient = await createClient({ name: 'OverrideClient' });

    await createClientRegistration(primaryClient.id, law.id);
    await createClientRegistration(overrideClient.id, law.id);

    // Per-client override: same law, different team, scoped to one client.
    await createLawHandler({
      lawId: law.id,
      orgEntityId: overrideTeam.id,
      clientId: overrideClient.id,
      isPrimary: false,
    });

    await runGenerator('2026-06-15T02:00:00Z');
  });

  test('US-5.1 generated filings inherit the primary law-handler\'s team by default', async () => {
    const all = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const primary = all.data.filter(
      (f) => f.ruleId === rule.id && f.clientId === primaryClient.id,
    );
    expect(primary.length, 'primary client should have generated filings').toBeGreaterThan(0);

    for (const filing of primary) {
      expect(
        filing.assigneeTeamId,
        `filing ${filing.id} should be team-owned by the default team`,
      ).toBe(defaultTeam.id);
    }
  });

  test('US-5.2 client-specific law-handler overrides the default team', async () => {
    const all = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const overridden = all.data.filter(
      (f) => f.ruleId === rule.id && f.clientId === overrideClient.id,
    );
    expect(overridden.length, 'override client should have generated filings').toBeGreaterThan(0);

    for (const filing of overridden) {
      expect(
        filing.assigneeTeamId,
        `filing ${filing.id} should use the override team, not the default`,
      ).toBe(overrideTeam.id);
    }
  });
});
