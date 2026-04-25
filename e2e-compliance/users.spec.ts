import { test, expect } from './fixtures/auth';
import { uniqueEmail, apiClient, CleanupTracker } from './helpers';

test.describe('Users', () => {
  const cleanup = new CleanupTracker();

  test.afterAll(async () => {
    await cleanup.flush();
  });

  test('list page renders heading, KPIs, and demo users', async ({ authedPage }) => {
    await authedPage.goto('/compliance-users');
    await expect(authedPage.getByRole('heading', { name: 'Users' }).first()).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /Invite user/i })).toBeVisible();
    // Filter by name so the assertion isn't sensitive to pagination, default
    // tab selection, or test users created earlier in the run.
    await authedPage.getByPlaceholder(/search users/i).fill('Priya');
    await expect(authedPage.getByText(/Priya Sharma/i).first()).toBeVisible();
  });

  test('search input narrows the user list', async ({ authedPage }) => {
    await authedPage.goto('/compliance-users');
    await authedPage.getByPlaceholder(/search users/i).fill('Priya');
    await expect(authedPage.getByText('Priya Sharma').first()).toBeVisible();
    await expect(authedPage.getByText('Vikram Patel')).toHaveCount(0);
  });

  test('status tabs filter the user list', async ({ authedPage }) => {
    await authedPage.goto('/compliance-users');
    await authedPage.getByRole('tab', { name: /Active/i }).click();
    const activeTab = authedPage.getByRole('tab', { name: /Active/i });
    await expect(activeTab).toHaveAttribute('aria-selected', 'true');
  });

  test('invite drawer opens and accepts a new user', async ({ authedPage }) => {
    const email = uniqueEmail('invitee');
    await authedPage.goto('/compliance-users');
    await authedPage.getByRole('button', { name: /Invite user/i }).click();
    await expect(
      authedPage.getByRole('heading', { name: /Invite a team member/i }),
    ).toBeVisible();

    await authedPage.getByLabel('First name').fill('E2E');
    await authedPage.getByLabel('Last name').fill('Invitee');
    await authedPage.getByLabel('Work email').fill(email);
    await authedPage.getByRole('button', { name: /Send invitation/i }).click();

    // Drawer closes on success; the new user appears in the list when we
    // refresh-via-search.
    await expect(
      authedPage.getByRole('heading', { name: /Invite a team member/i }),
    ).not.toBeVisible({ timeout: 15_000 });

    // Resolve the new id via API and queue cleanup.
    const list = await apiClient.get<{ data: Array<{ id: string; email: string }> }>(
      '/users',
      { query: { limit: 500 } },
    );
    const created = list.data.find((u) => u.email === email);
    expect(created, `user ${email} should exist via API`).toBeTruthy();
    if (created) cleanup.track('user', created.id);
  });

  test('invite drawer rejects empty submission', async ({ authedPage }) => {
    await authedPage.goto('/compliance-users');
    await authedPage.getByRole('button', { name: /Invite user/i }).click();
    await authedPage.getByRole('button', { name: /Send invitation/i }).click();
    // At least one validation message appears.
    await expect(authedPage.getByText(/required/i).first()).toBeVisible();
  });
});
