import { test, expect } from './fixtures/auth';
import { resetState, uniqueName, uniqueSlug, apiClient } from './helpers';

test.describe('Laws', () => {
  test.beforeAll(async () => {
    await resetState();
  });

  test('list page renders header, KPI tiles, and seeded laws', async ({ authedPage }) => {
    await authedPage.goto('/laws');
    await expect(authedPage.getByRole('heading', { name: 'Laws' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: 'New law' })).toBeVisible();
    // KPI tiles
    await expect(authedPage.getByText('Acts').first()).toBeVisible();
    await expect(authedPage.getByText('Central').first()).toBeVisible();
    // System-seeded laws — survive resetState.
    await expect(authedPage.getByText('TDS').first()).toBeVisible();
    await expect(authedPage.getByText('GST').first()).toBeVisible();
    await expect(authedPage.getByText('ROC').first()).toBeVisible();
  });

  test('list shows the search affordance with placeholder text', async ({ authedPage }) => {
    await authedPage.goto('/laws');
    // The laws page renders a custom search bar in the list panel (not a
    // native <input>); we just assert the placeholder copy is on screen.
    await expect(authedPage.getByText(/search citations/i).first()).toBeVisible();
  });

  test('clicking a law in the list updates the detail panel', async ({ authedPage }) => {
    await authedPage.goto('/laws');
    await authedPage.getByText('GST', { exact: true }).first().click();
    await expect(
      authedPage.getByRole('heading', { name: 'Goods & Services Tax', level: 2 }),
    ).toBeVisible();
  });

  test('create a new law via the drawer, see it in the list', async ({ authedPage }) => {
    const code = `E2E-${uniqueSlug('law').slice(-8).toUpperCase()}`;
    const name = uniqueName('Law');

    await authedPage.goto('/laws');
    await authedPage.getByRole('button', { name: 'New law' }).click();
    await expect(authedPage.getByRole('heading', { name: 'Add law', level: 2 })).toBeVisible();

    await authedPage.getByRole('textbox', { name: 'Code' }).fill(code);
    await authedPage.getByRole('textbox', { name: 'Name' }).fill(name);
    await authedPage
      .getByRole('textbox', { name: 'Issuing authority' })
      .fill('E2E Authority');
    await authedPage.getByRole('button', { name: 'Create law' }).click();

    // Drawer closes; the new law appears in the list.
    await expect(
      authedPage.getByRole('heading', { name: 'Add law', level: 2 }),
    ).not.toBeVisible({ timeout: 10_000 });
    await expect(authedPage.getByText(code).first()).toBeVisible({ timeout: 10_000 });

    // Sanity-check via API.
    const list = await apiClient.get<{ data: Array<{ id: string; code: string }> }>(
      '/laws',
      { query: { limit: 200 } },
    );
    expect(list.data.find((law) => law.code === code), `law ${code} should exist via API`).toBeTruthy();
  });

  test('drawer rejects submission when required fields are empty', async ({ authedPage }) => {
    await authedPage.goto('/laws');
    await authedPage.getByRole('button', { name: 'New law' }).click();
    await authedPage.getByRole('button', { name: 'Create law' }).click();
    // Drawer remains open — validation blocks submission. Heading still visible.
    await expect(authedPage.getByRole('heading', { name: 'Add law', level: 2 })).toBeVisible();
  });
});
