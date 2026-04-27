import { test, expect } from './fixtures/auth';
import { resetState, apiClient } from './helpers';
import { createClient, type CreatedClient } from './fixtures/clients';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';
import { getSystemLaw, type Law } from './fixtures/laws';
import { createLawHandler } from './fixtures/law-handlers';
import { createComplianceRule } from './fixtures/rules';
import { createClientRegistration } from './fixtures/registrations';
import { runGenerator } from './fixtures/cron';
import { transitionFiling, updateFiling } from './fixtures/filings';
import { createUser, type CreatedUser } from './fixtures/users';

interface FilingRow {
  id: string;
  ruleId: string;
  clientId: string;
  status: string;
  assigneeId: string | null;
  assigneeTeamId: string;
}

/**
 * §7 + §12 filing assignment and continuity through churn.
 *
 *   US-7.1 Generated filings are team-owned (assigneeTeamId set, assigneeId
 *          null on the freshly-generated row).
 *   US-7.2 Pickup — the platform's `compliance-filings.pickup` permission
 *          gates the `pending → in_progress` transition; the test asserts
 *          the transition flips status and the caller can stamp themselves
 *          as the assignee via PATCH.
 *   US-7.3 Reassign — PATCH assigneeId from Alice to Bob succeeds while
 *          the filing is non-terminal.
 *   US-12.1 Reassignment leaves the team unchanged — same test as US-7.3,
 *          additionally asserts assigneeTeamId is untouched.
 *
 * US-7.4, US-12.2, and US-12.3 cover the user-deactivation cascade and
 * are recorded as a single `test.skip` block — V1 has no compliance-side
 * listener for `users.Deleted` (the platform's USERS_USER_DEACTIVATED
 * event), so marking a user inactive currently leaves their assigneeId
 * stale on every non-terminal filing. Unblocks by adding a listener in
 * `domains/compliance/api/compliance-filings/`.
 */
test.describe('Flow: filing assignment + continuity (US-7.x / US-12.x)', () => {
  let team: OrgUnit;
  let alice: CreatedUser;
  let bob: CreatedUser;
  let law: Law;
  let client: CreatedClient;
  let rule: { id: string };

  test.beforeAll(async () => {
    await resetState();
    team = await createOrgUnit({ level: 'Team' });
    alice = await createUser({ firstName: 'Alice', lastName: 'Original' });
    bob = await createUser({ firstName: 'Bob', lastName: 'Replacement' });

    law = await getSystemLaw('GST');
    await createLawHandler({ lawId: law.id, orgEntityId: team.id });
    client = await createClient();
    rule = await createComplianceRule({ lawId: law.id });
    await createClientRegistration(client.id, law.id);

    await runGenerator('2026-06-15T02:00:00Z');
  });

  test('US-7.1 generated filings carry assigneeTeamId and start unassigned individually', async () => {
    const all = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const ours = all.data.filter((f) => f.ruleId === rule.id && f.clientId === client.id);
    expect(ours.length, 'sweep should produce filings').toBeGreaterThan(0);

    for (const filing of ours) {
      expect(filing.assigneeTeamId, `filing ${filing.id} must be team-owned`).toBeTruthy();
      expect(filing.assigneeTeamId).toBe(team.id);
      expect(filing.assigneeId, `filing ${filing.id} starts with no individual owner`).toBeNull();
    }
  });

  test('US-7.2 pickup transitions pending→in_progress and stamps the picker as assignee', async () => {
    const all = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const target = all.data.find(
      (f) => f.ruleId === rule.id && f.clientId === client.id && f.status === 'pending',
    );
    expect(target, 'a pending filing should exist for pickup').toBeTruthy();
    if (!target) return;

    // Pickup: transition to in_progress (gated by compliance-filings.pickup
    // permission) and PATCH assigneeId to claim individual ownership.
    await updateFiling(target.id, { assigneeId: alice.id });
    const transitioned = await transitionFiling(target.id, 'in_progress');

    expect(transitioned.status).toBe('in_progress');
    expect(transitioned.assigneeId).toBe(alice.id);
    // Team ownership untouched throughout.
    expect(transitioned.assigneeTeamId).toBe(team.id);
  });

  test('US-7.3 / US-12.1 reassign within a team changes assigneeId but not assigneeTeamId', async () => {
    const all = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const target = all.data.find(
      (f) => f.ruleId === rule.id && f.clientId === client.id && f.status === 'pending',
    );
    expect(target, 'another pending filing should exist for reassign').toBeTruthy();
    if (!target) return;

    // Initial assignment to Alice.
    const claimed = await updateFiling(target.id, { assigneeId: alice.id });
    expect(claimed.assigneeId).toBe(alice.id);
    expect(claimed.assigneeTeamId).toBe(team.id);

    // Reassign to Bob.
    const reassigned = await updateFiling(target.id, { assigneeId: bob.id });
    expect(reassigned.assigneeId).toBe(bob.id);
    expect(
      reassigned.assigneeTeamId,
      'team ownership must survive reassignment (US-12.1)',
    ).toBe(team.id);
  });

  test.skip('US-7.4 / US-12.2 / US-12.3 user deactivation clears individual but preserves team assignments', async () => {
    // V1 gap — there is no compliance-side listener for the users.Deleted
    // (USERS_USER_DEACTIVATED) event, so marking a user inactive currently
    // leaves their `assigneeId` stale on every non-terminal filing. To
    // unblock this test:
    //
    //   1. Add a listener (likely in domains/compliance/api/compliance-filings/)
    //      that null-outs `assigneeId` on non-terminal filings whose
    //      assignee = userId.
    //   2. Confirm `assigneeTeamId` is left intact by that listener.
    //   3. Unskip and assert the cascade end-to-end.
    //
    // The behaviour spec calls for is:
    //   - Mark Alice inactive (DELETE /users/:id stamps users.deletedAt).
    //   - Every non-terminal filing where assigneeId = alice gets cleared.
    //   - assigneeTeamId on those filings is unchanged.
    //   - Completed / cancelled filings are not modified.
  });
});
