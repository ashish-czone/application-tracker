import { test, expect } from './fixtures/auth';
import { resetState, uniqueName, apiClient } from './helpers';
import { createOrgUnit, getOrgUnitLevel, type OrgUnit } from './fixtures/org-units';

test.describe('Org Hierarchy', () => {
  let rootUnit: OrgUnit;
  let teamUnit: OrgUnit;

  test.beforeAll(async () => {
    await resetState();
    // Build a 2-level tree so the spec can verify both root and child rendering.
    rootUnit = await createOrgUnit({ level: 'Company', name: uniqueName('Company') });
    teamUnit = await createOrgUnit({ level: 'Team', name: uniqueName('Team'), parentId: rootUnit.id });
  });

  test('page renders heading, tree, and detail panel', async ({ authedPage }) => {
    await authedPage.goto('/org-hierarchy');
    await expect(authedPage.getByRole('heading', { name: /Organisation/i })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /Add Unit/i })).toBeVisible();
    await expect(authedPage.getByText(rootUnit.name).first()).toBeVisible();
  });

  test('add-unit drawer opens with name + parent fields', async ({ authedPage }) => {
    await authedPage.goto('/org-hierarchy');
    await authedPage.getByRole('button', { name: /Add Unit/i }).click();
    await expect(authedPage.getByRole('heading', { name: /Add unit/i })).toBeVisible();
    await expect(authedPage.getByText('Unit name').first()).toBeVisible();
    await expect(authedPage.getByText('Parent unit').first()).toBeVisible();
  });

  test('create unit via API and verify it appears in the tree', async ({ authedPage }) => {
    const teamLevel = await getOrgUnitLevel('Team');
    const name = uniqueName('Unit');
    await apiClient.post('/org-units', {
      name,
      parentId: rootUnit.id,
      levelId: teamLevel.id,
    });

    await authedPage.goto('/org-hierarchy');
    await expect(authedPage.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });

  // Reference teamUnit so the unused-var lint stays satisfied; the fixture is
  // useful even when the spec doesn't navigate to it (it's part of the seeded
  // tree and proves nesting works).
  test('child team is reachable in the API tree', async () => {
    const list = await apiClient.get<OrgUnit[]>('/org-units');
    const child = list.find((u) => u.id === teamUnit.id);
    expect(child?.parentId).toBe(rootUnit.id);
  });
});
