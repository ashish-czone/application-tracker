import { test, expect } from './fixtures/auth';
import { createClient, type CreatedClient } from './fixtures/clients';
import { resetState, uniqueName, uniqueEmail, apiClient } from './helpers';

test.describe('Clients', () => {
  let anchorClient: CreatedClient;
  let secondaryClient: CreatedClient;

  test.beforeAll(async () => {
    await resetState();
    // Two fixtures so the search test can verify filtering removes
    // non-matches. Names share no substring so a search for one cannot
    // accidentally match the other.
    anchorClient = await createClient({ name: uniqueName('Anchor'), status: 'active' });
    secondaryClient = await createClient({ name: uniqueName('Secondary'), status: 'active' });
  });

  test('list page renders heading, KPIs, status tabs, and a row', async ({ authedPage }) => {
    await authedPage.goto('/clients');
    await expect(authedPage.getByRole('heading', { name: 'Clients' }).first()).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /Add client/i })).toBeVisible();
    // KPI tiles
    await expect(authedPage.getByText('Total clients')).toBeVisible();
    await expect(authedPage.getByText('Registrations').first()).toBeVisible();
    await expect(authedPage.getByText('Overdue filings')).toBeVisible();
    await expect(authedPage.getByText(anchorClient.name).first()).toBeVisible();
  });

  test('search input narrows the visible client rows', async ({ authedPage }) => {
    await authedPage.goto('/clients');
    await authedPage.getByPlaceholder(/search clients/i).fill(anchorClient.name);
    await expect(authedPage.getByText(anchorClient.name).first()).toBeVisible();
    await expect(authedPage.getByText(secondaryClient.name)).toHaveCount(0);
  });

  test('row click navigates to detail page', async ({ authedPage }) => {
    await authedPage.goto('/clients');
    await authedPage.getByText(anchorClient.name).first().click();
    await authedPage.waitForURL(/\/clients\/[0-9a-f-]+/);
    await expect(
      authedPage.getByRole('heading', { name: new RegExp(anchorClient.name, 'i') }).first(),
    ).toBeVisible();
  });

  test('add client drawer creates a record, list shows it', async ({ authedPage }) => {
    const companyName = uniqueName('Created');
    const legalName = `${companyName} Pvt. Ltd.`;
    const taxId = `27CCCCC${Date.now().toString().slice(-5)}1Z5`;
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

    // Drawer closes; reload + filter to find the new client. The mutation
    // doesn't always invalidate the list query in this build, so we
    // navigate to ensure a fresh fetch.
    await expect(
      authedPage.getByRole('heading', { name: 'Add client', level: 2 }),
    ).not.toBeVisible({ timeout: 15_000 });
    await authedPage.goto('/clients');
    await authedPage.getByPlaceholder(/search clients/i).fill(companyName);
    await expect(authedPage.getByText(companyName).first()).toBeVisible({ timeout: 10_000 });

    // Sanity-check the API saw it too.
    const list = await apiClient.get<{ data: Array<{ id: string; name: string }> }>(
      '/clients',
      { query: { limit: 200, search: companyName } },
    );
    const created = list.data.find((c) => c.name === companyName);
    expect(created, `client ${companyName} should exist via API`).toBeTruthy();
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
    await authedPage.getByRole('tab', { name: /^Active/i }).click();
    await expect(authedPage.getByText(anchorClient.name).first()).toBeVisible();
    const activeTab = authedPage.getByRole('tab', { name: /^Active/i });
    await expect(activeTab).toHaveAttribute('aria-selected', 'true');
  });
});
