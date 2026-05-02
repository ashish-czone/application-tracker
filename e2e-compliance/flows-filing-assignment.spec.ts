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
import { createUser, deactivateUser, type CreatedUser } from './fixtures/users';

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
 *   US-7.4 / US-12.2 / US-12.3 User deactivation cascades: assigneeId is
 *          cleared on every non-terminal filing the user owned;
 *          assigneeTeamId is preserved (so the team can pick the work back
 *          up); terminal filings (completed / cancelled) are left
 *          untouched. Driven from `AppUsersService.cleanupOnSoftDelete`,
 *          not via an event listener — so failures abort the deactivation
 *          atomically. One batched audit entry is emitted.
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

  test('US-7.4 / US-12.2 / US-12.3 user deactivation clears individual but preserves team assignments', async () => {
    // Bring up an isolated state for this test: a fresh team / user / law /
    // client / rule, and a sweep that materialises several filings. We
    // can't reuse the suite-level fixture because earlier tests have
    // already mutated the assignees on those filings.
    await resetState();
    const isolatedTeam = await createOrgUnit({ level: 'Team' });
    const carol = await createUser({ firstName: 'Carol', lastName: 'Deactivate' });
    const dave = await createUser({ firstName: 'Dave', lastName: 'Bystander' });

    const isolatedLaw = await getSystemLaw('GST');
    await createLawHandler({ lawId: isolatedLaw.id, orgEntityId: isolatedTeam.id });
    const isolatedClient = await createClient();
    const isolatedRule = await createComplianceRule({ lawId: isolatedLaw.id });
    await createClientRegistration(isolatedClient.id, isolatedLaw.id);
    await runGenerator('2026-06-15T02:00:00Z');

    const all = await apiClient.get<{ data: FilingRow[] }>(`/compliance-filings?limit=200`);
    const ours = all.data.filter(
      (f) => f.ruleId === isolatedRule.id && f.clientId === isolatedClient.id,
    );
    expect(ours.length, 'sweep should produce filings to assign').toBeGreaterThanOrEqual(3);

    // Assign Carol to two filings, Dave to one. One of Carol's filings is
    // then transitioned to `completed` so we can verify terminal filings
    // are untouched by the cascade.
    const [carolNonTerminal, carolToComplete, daveFiling] = ours;

    await updateFiling(carolNonTerminal.id, { assigneeId: carol.id });
    await updateFiling(carolToComplete.id, { assigneeId: carol.id });
    await updateFiling(daveFiling.id, { assigneeId: dave.id });

    // Drive the second Carol filing to a terminal state. The reviewer-
    // signoff transition (`review → completed`) requires a comment per
    // COMPLIANCE_FILINGS_WORKFLOW.
    await transitionFiling(carolToComplete.id, 'in_progress');
    await transitionFiling(carolToComplete.id, 'review');
    await transitionFiling(carolToComplete.id, 'completed', {
      comment: 'E2E flow: completing fixture filing for assignment test',
    });

    // Sanity: pre-deactivation state matches what we set up.
    const beforeRow = (await apiClient.get<{ data: FilingRow[] }>(
      `/compliance-filings?limit=200`,
    )).data;
    const carolNonTerminalBefore = beforeRow.find((f) => f.id === carolNonTerminal.id)!;
    const carolCompletedBefore = beforeRow.find((f) => f.id === carolToComplete.id)!;
    const daveBefore = beforeRow.find((f) => f.id === daveFiling.id)!;
    expect(carolNonTerminalBefore.assigneeId).toBe(carol.id);
    expect(carolCompletedBefore.assigneeId).toBe(carol.id);
    expect(carolCompletedBefore.status).toBe('completed');
    expect(daveBefore.assigneeId).toBe(dave.id);

    // Trigger the cascade: deactivate Carol.
    await deactivateUser(carol.id);

    const after = (await apiClient.get<{ data: FilingRow[] }>(
      `/compliance-filings?limit=200`,
    )).data;
    const carolNonTerminalAfter = after.find((f) => f.id === carolNonTerminal.id)!;
    const carolCompletedAfter = after.find((f) => f.id === carolToComplete.id)!;
    const daveAfter = after.find((f) => f.id === daveFiling.id)!;

    // US-7.4 / US-12.2: non-terminal filing assigned to Carol has assigneeId
    // cleared, but assigneeTeamId is preserved so the team can pick it up.
    expect(carolNonTerminalAfter.assigneeId, 'Carol non-terminal assigneeId cleared').toBeNull();
    expect(carolNonTerminalAfter.assigneeTeamId, 'team preserved on non-terminal filing').toBe(
      isolatedTeam.id,
    );

    // US-12.3: terminal filings (completed / cancelled) are not modified —
    // Carol's completed filing keeps her assigneeId because that's the
    // historical record of who closed it.
    expect(carolCompletedAfter.assigneeId, 'completed filing keeps original assignee').toBe(
      carol.id,
    );

    // Dave's filing is unrelated and must not be touched.
    expect(daveAfter.assigneeId, "another user's filing is not affected").toBe(dave.id);
  });
});
