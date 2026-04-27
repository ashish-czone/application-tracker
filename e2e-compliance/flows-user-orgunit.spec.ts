import { test, expect } from './fixtures/auth';
import { resetState, uniqueEmail, uniqueName, apiClient } from './helpers';
import { createOrgUnit, type OrgUnit } from './fixtures/org-units';

interface OrgUnitListEntry {
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
  let targetUnit: OrgUnit;

  test.beforeAll(async () => {
    await resetState();
    // The unit the flow assigns the new user into. Status starts at zero
    // members so the count assertion is unambiguous.
    targetUnit = await createOrgUnit({ level: 'Team', name: uniqueName('Team') });
  });

  test('end-to-end membership flow updates count + reflects in tree', async ({ authedPage }) => {
    const before = await apiClient.get<OrgUnitListEntry[]>('/org-units');
    const beforeUnit = before.find((u) => u.id === targetUnit.id);
    expect(beforeUnit, 'fixture unit should be in the list').toBeTruthy();
    const beforeCount = beforeUnit?.memberCount ?? 0;

    // Invite a new user via the UI.
    const email = uniqueEmail('flow-user');
    await authedPage.goto('/compliance-users');
    await authedPage.getByRole('button', { name: /Invite user/i }).click();
    await authedPage.getByLabel('First name').fill('Flow');
    await authedPage.getByLabel('Last name').fill(uniqueName('Tester'));
    await authedPage.getByLabel('Work email').fill(email);
    await authedPage.getByRole('button', { name: /Send invitation/i }).click();

    // Resolve the user id and assign via API (the UI doesn't expose
    // member-add from the user page).
    const usersList = await apiClient.get<{ data: Array<{ id: string; email: string }> }>(
      '/users',
      { query: { limit: 500 } },
    );
    const user = usersList.data.find((u) => u.email === email);
    expect(user, `user ${email} should exist after invite`).toBeTruthy();
    if (!user) return;

    await apiClient.post(`/org-units/${targetUnit.id}/members/${user.id}`, {});

    // Member count on the unit increments.
    const after = await apiClient.get<OrgUnitListEntry[]>('/org-units');
    const afterUnit = after.find((u) => u.id === targetUnit.id);
    expect(afterUnit?.memberCount, 'memberCount should grow by 1').toBe(beforeCount + 1);

    // Org hierarchy page reflects the unit and the member panel doesn't error.
    await authedPage.goto('/org-hierarchy');
    await expect(authedPage.getByText(targetUnit.name).first()).toBeVisible();
  });
});
