import { test, expect } from '@playwright/test';
import { setupAllMocks, MOCK_DATA } from './fixtures/setup';

test.describe('Clients', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  // ---------------------------------------------------------------------------
  // List Page
  // ---------------------------------------------------------------------------

  test.describe('List page', () => {
    test('should display page heading and add button', async ({ page }) => {
      await page.goto('/clients');
      await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Client' })).toBeVisible();
    });

    test('should display clients in the data grid', async ({ page }) => {
      await page.goto('/clients');
      const first = MOCK_DATA.clients[MOCK_DATA.clients.length - 1];
      await expect(page.locator('table').getByText(first.clientName).first()).toBeVisible();
    });

    test('should show pagination info', async ({ page }) => {
      await page.goto('/clients');
      await expect(page.getByText(/Showing .* to .* of .* results/)).toBeVisible();
    });

    test('should filter by search', async ({ page }) => {
      await page.goto('/clients');
      await page.getByPlaceholder('Search clients...').fill('Acme');
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/search=Acme/);
    });

    test('should sort by client name', async ({ page }) => {
      await page.goto('/clients');
      await page.locator('th').getByText('Client Name').click();
      await expect(page).toHaveURL(/sort=clientName/);
    });

    test('should navigate to detail on name click', async ({ page }) => {
      await page.goto('/clients');
      const first = MOCK_DATA.clients[MOCK_DATA.clients.length - 1];
      await page.locator('table').getByText(first.clientName).first().click();
      await expect(page).toHaveURL(new RegExp(`/clients/${first.id}`));
    });

    test('should show empty state when no results', async ({ page }) => {
      await page.goto('/clients');
      await page.getByPlaceholder('Search clients...').fill('zzzznonexistent');
      await page.waitForTimeout(500);
      await expect(page.getByText('No clients yet')).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Quick Create
  // ---------------------------------------------------------------------------

  test.describe('Quick create', () => {
    test('should open quick create modal', async ({ page }) => {
      await page.goto('/clients');
      await page.getByRole('button', { name: 'Add Client' }).click();
      await expect(page.getByRole('heading', { name: 'Add Client' })).toBeVisible();
    });

    test('should show client name field', async ({ page }) => {
      await page.goto('/clients');
      await page.getByRole('button', { name: 'Add Client' }).click();
      await expect(page.getByLabel('Client Name')).toBeVisible();
    });

    test('should submit and navigate to detail', async ({ page }) => {
      await page.goto('/clients');
      await page.getByRole('button', { name: 'Add Client' }).click();
      await page.getByLabel('Client Name').fill('New Test Client');
      await page.getByRole('button', { name: 'Create Client' }).click();
      await expect(page).toHaveURL(/\/clients\/new-entity-001/);
    });
  });

  // ---------------------------------------------------------------------------
  // Detail Page
  // ---------------------------------------------------------------------------

  test.describe('Detail page', () => {
    test('should display client name', async ({ page }) => {
      const client = MOCK_DATA.clients[0];
      await page.goto(`/clients/${client.id}`);
      await expect(page.getByText(client.clientName).first()).toBeVisible();
    });

    test('should show back link to clients list', async ({ page }) => {
      const client = MOCK_DATA.clients[0];
      await page.goto(`/clients/${client.id}`);
      await expect(page.getByText('Clients').first()).toBeVisible();
    });

    test('should display sections from layout', async ({ page }) => {
      const client = MOCK_DATA.clients[0];
      await page.goto(`/clients/${client.id}`);
      await expect(page.getByText('Client Information')).toBeVisible();
    });

    test('should navigate back to list', async ({ page }) => {
      const client = MOCK_DATA.clients[0];
      await page.goto(`/clients/${client.id}`);
      const backLink = page.locator('a, button').filter({ hasText: 'Clients' }).first();
      await backLink.click();
      await expect(page).toHaveURL('/clients');
    });
  });
});
