import { test, expect } from './fixtures/auth';
import { uniqueName, apiClient, CleanupTracker } from './helpers';

interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
}

test.describe('Org Hierarchy', () => {
  const cleanup = new CleanupTracker();

  test.afterAll(async () => {
    await cleanup.flush();
  });

  test('page renders heading, tree, and detail panel', async ({ authedPage }) => {
    await authedPage.goto('/org-hierarchy');
    await expect(authedPage.getByRole('heading', { name: /Organisation/i })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /Add Unit/i })).toBeVisible();
    // Demo seed includes a Compliance Team unit.
    await expect(authedPage.getByText(/Compliance Team/).first()).toBeVisible();
  });

  test('add-unit drawer opens with name + parent fields', async ({ authedPage }) => {
    await authedPage.goto('/org-hierarchy');
    await authedPage.getByRole('button', { name: /Add Unit/i }).click();
    await expect(authedPage.getByRole('heading', { name: /Add unit/i })).toBeVisible();
    await expect(authedPage.getByText('Unit name').first()).toBeVisible();
    await expect(authedPage.getByText('Parent unit').first()).toBeVisible();
  });

  test('create unit via API and verify it appears in the tree', async ({ authedPage }) => {
    // Find an existing parent unit (the root-level one seeded by demo).
    const list = await apiClient.get<OrgUnit[]>('/org-units');
    const root = list.find((u) => u.parentId === null) ?? list[0];
    expect(root, 'should have at least one seeded org-unit').toBeTruthy();
    if (!root) return;

    // Find a level the parent allows. The simplest path is to find any
    // existing child of root and copy its levelId.
    const sibling = list.find((u) => u.parentId === root.id);
    if (!sibling) {
      test.skip(true, 'no demo child unit to derive levelId from');
      return;
    }
    const levelId = (sibling as OrgUnit & { levelId: string }).levelId;

    const name = uniqueName('Unit');
    const created = await apiClient.post<OrgUnit>('/org-units', {
      name,
      parentId: root.id,
      levelId,
    });
    cleanup.track('org-unit', created.id);

    await authedPage.goto('/org-hierarchy');
    await expect(authedPage.getByText(name).first()).toBeVisible({ timeout: 10_000 });
  });
});
