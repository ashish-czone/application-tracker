import { test, expect } from './fixtures/auth';
import { uniqueName, uniqueEmail, apiClient, CleanupTracker } from './helpers';

test.describe('Clients', () => {
  const cleanup = new CleanupTracker();

  test.afterAll(async () => {
    await cleanup.flush();
  });

  test('list page renders heading, KPIs, status tabs, and a row', async ({ authedPage }) => {
    await authedPage.goto('/clients');
    await expect(authedPage.getByRole('heading', { name: 'Clients' }).first()).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /Add client/i })).toBeVisible();
    // KPI tiles
    await expect(authedPage.getByText('Total clients')).toBeVisible();
    await expect(authedPage.getByText('Registrations').first()).toBeVisible();
    await expect(authedPage.getByText('Overdue filings')).toBeVisible();
    // Demo seed includes "Lumen Tech".
    await expect(authedPage.getByText('Lumen Tech').first()).toBeVisible();
  });

  test('search input narrows the visible client rows', async ({ authedPage }) => {
    await authedPage.goto('/clients');
    await authedPage.getByPlaceholder(/search clients/i).fill('Lumen');
    // Lumen Tech remains, an unrelated demo client (Greenfield Agri) drops.
    await expect(authedPage.getByText('Lumen Tech').first()).toBeVisible();
    await expect(authedPage.getByText('Greenfield Agri')).toHaveCount(0);
  });

  test('row click navigates to detail page', async ({ authedPage }) => {
    await authedPage.goto('/clients');
    await authedPage.getByText('Lumen Tech').first().click();
    await authedPage.waitForURL(/\/clients\/[0-9a-f-]+/);
    await expect(authedPage.getByRole('heading', { name: /Lumen Tech/i }).first()).toBeVisible();
  });

  test('add client drawer creates a record, list shows it, then cleanup deletes', async ({
    authedPage,
  }) => {
    const companyName = uniqueName('Client');
    const legalName = `${companyName} Pvt. Ltd.`;
    const taxId = `27AAAAA${Date.now().toString().slice(-5)}1Z5`;
    const contactEmail = uniqueEmail('contact');

    await authedPage.goto('/clients');
    await authedPage.getByRole('button', { name: /Add client/i }).click();
    await expect(authedPage.getByRole('heading', { name: 'Add client', level: 2 })).toBeVisible();

    await authedPage.getByLabel('Company name').fill(companyName);
    await authedPage.getByLabel('Legal name').fill(legalName);
    await authedPage.getByLabel('Tax identifier').fill(taxId);
    await authedPage.getByLabel('Contact name').fill('E2E Contact');
    await authedPage.getByLabel('Contact email').fill(contactEmail);
    // FormPhoneInput renders an internal `react-phone-number-input` whose
    // input doesn't pick up the wrapper label — locate by placeholder.
    await authedPage.getByPlaceholder('Phone number').fill('+919876543210');

    await authedPage.getByRole('button', { name: /^Add client$/ }).last().click();

    // Drawer closes; client appears in the list.
    await expect(
      authedPage.getByRole('heading', { name: 'Add client', level: 2 }),
    ).not.toBeVisible({ timeout: 15_000 });
    await expect(authedPage.getByText(companyName).first()).toBeVisible({ timeout: 10_000 });

    // Resolve id via API for cleanup.
    const list = await apiClient.get<{ data: Array<{ id: string; name: string }> }>(
      '/clients',
      { query: { limit: 200 } },
    );
    const created = list.data.find((c) => c.name === companyName);
    expect(created, `client ${companyName} should exist via API`).toBeTruthy();
    if (created) cleanup.track('client', created.id);
  });

  test('drawer rejects empty submission with validation errors', async ({ authedPage }) => {
    await authedPage.goto('/clients');
    await authedPage.getByRole('button', { name: /Add client/i }).click();
    await authedPage.getByRole('button', { name: /^Add client$/ }).last().click();
    // At least one validation error is visible.
    await expect(authedPage.getByText(/required/i).first()).toBeVisible();
    // Drawer remains open.
    await expect(authedPage.getByRole('heading', { name: 'Add client', level: 2 })).toBeVisible();
  });

  test('status tabs filter the list', async ({ authedPage }) => {
    await authedPage.goto('/clients');
    // Click "Onboarding" tab — Greenfield Agri is seeded as onboarding.
    await authedPage.getByRole('tab', { name: /onboarding/i }).click();
    await expect(authedPage.getByText('Greenfield Agri').first()).toBeVisible();
  });
});
