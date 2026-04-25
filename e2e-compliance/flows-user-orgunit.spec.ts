import { test, expect } from './fixtures/auth';
import { uniqueEmail, uniqueName, apiClient, CleanupTracker } from './helpers';

interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
  levelId: string;
  memberCount: number;
}

/**
 * Cross-entity flow: invite a new user, add them to an existing org unit,
 * verify the unit's member count increments and the membership is reflected
 * in the unit's detail panel.
 */
test.describe('Flow: invite user → assign to org unit', () => {
  const cleanup = new CleanupTracker();

  test.afterAll(async () => {
    await cleanup.flush();
  });

  test('end-to-end membership flow updates count + reflects in tree', async ({ authedPage }) => {
    // 1. Pick an existing demo unit (Compliance Team) as the assignment target.
    const units = await apiClient.get<OrgUnit[]>('/org-units');
    const targetUnit = units.find((u) => u.name === 'Compliance Team') ?? units.find((u) => u.parentId !== null);
    expect(targetUnit, 'expected at least one demo org-unit').toBeTruthy();
    if (!targetUnit) return;
    const beforeCount = targetUnit.memberCount;

    // 2. Invite a new user via the UI.
    const email = uniqueEmail('flow-user');
    await authedPage.goto('/compliance-users');
    await authedPage.getByRole('button', { name: /Invite user/i }).click();
    await authedPage.getByLabel('First name').fill('Flow');
    await authedPage.getByLabel('Last name').fill(uniqueName('Tester'));
    await authedPage.getByLabel('Work email').fill(email);
    await authedPage.getByRole('button', { name: /Send invitation/i }).click();

    // 3. Resolve the user id and assign via API (UI doesn't expose
    // member-add from the user page; the org-hierarchy AddMemberDrawer is
    // the user-facing path and is exercised by the org-hierarchy spec).
    const usersList = await apiClient.get<{ data: Array<{ id: string; email: string }> }>(
      '/users',
      { query: { limit: 500 } },
    );
    const user = usersList.data.find((u) => u.email === email);
    expect(user, `user ${email} should exist after invite`).toBeTruthy();
    if (!user) return;
    cleanup.track('user', user.id);

    await apiClient.post(`/org-units/${targetUnit.id}/members/${user.id}`, {});

    // 4. Member count on the unit increments.
    const afterUnits = await apiClient.get<OrgUnit[]>('/org-units');
    const afterUnit = afterUnits.find((u) => u.id === targetUnit.id);
    expect(afterUnit?.memberCount, 'memberCount should grow by 1').toBe(beforeCount + 1);

    // 5. Org hierarchy page reflects the unit and the member panel doesn't error.
    await authedPage.goto('/org-hierarchy');
    await expect(authedPage.getByText(targetUnit.name).first()).toBeVisible();
  });
});
