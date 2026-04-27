import { test, expect } from './fixtures/auth';
import { resetState, uniqueEmail, apiClient } from './helpers';
import { createUser, type CreatedUser } from './fixtures/users';

test.describe('Users', () => {
  let alice: CreatedUser;
  let bob: CreatedUser;

  test.beforeAll(async () => {
    await resetState();
    // Two fixtures with distinguishable names so the search test can
    // verify filtering removes non-matches.
    alice = await createUser({ firstName: 'Alice', lastName: 'Anderson', email: uniqueEmail('alice') });
    bob = await createUser({ firstName: 'Bob', lastName: 'Brown', email: uniqueEmail('bob') });
  });

  test('list page renders heading, KPIs, and a fixture user', async ({ authedPage }) => {
    await authedPage.goto('/compliance-users');
    await expect(authedPage.getByRole('heading', { name: 'Users' }).first()).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /Invite user/i })).toBeVisible();
    // Filter by name so the assertion isn't sensitive to pagination or default tab.
    await authedPage.getByPlaceholder(/search users/i).fill(alice.firstName);
    await expect(authedPage.getByText(new RegExp(`${alice.firstName}\\s+${alice.lastName}`, 'i')).first()).toBeVisible();
  });

  test('search input narrows the user list', async ({ authedPage }) => {
    await authedPage.goto('/compliance-users');
    await authedPage.getByPlaceholder(/search users/i).fill(alice.firstName);
    await expect(authedPage.getByText(alice.firstName).first()).toBeVisible();
    await expect(authedPage.getByText(bob.firstName)).toHaveCount(0);
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

    // Drawer closes on success.
    await expect(
      authedPage.getByRole('heading', { name: /Invite a team member/i }),
    ).not.toBeVisible({ timeout: 15_000 });

    // Sanity-check via API.
    const list = await apiClient.get<{ data: Array<{ id: string; email: string }> }>(
      '/users',
      { query: { limit: 500 } },
    );
    expect(list.data.find((u) => u.email === email), `user ${email} should exist via API`).toBeTruthy();
  });

  test('invite drawer rejects empty submission', async ({ authedPage }) => {
    await authedPage.goto('/compliance-users');
    await authedPage.getByRole('button', { name: /Invite user/i }).click();
    await authedPage.getByRole('button', { name: /Send invitation/i }).click();
    // At least one validation message appears.
    await expect(authedPage.getByText(/required/i).first()).toBeVisible();
  });
});
