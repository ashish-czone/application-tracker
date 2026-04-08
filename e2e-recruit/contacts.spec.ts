import { test, expect } from '@playwright/test';
import { setupAllMocks, MOCK_DATA } from './fixtures/setup';

test.describe('Contacts', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  // ---------------------------------------------------------------------------
  // List Page
  // ---------------------------------------------------------------------------

  test.describe('List page', () => {
    test('should display page heading and add button', async ({ page }) => {
      await page.goto('/contacts');
      await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Contact' })).toBeVisible();
    });

    test('should display contacts in the data grid', async ({ page }) => {
      await page.goto('/contacts');
      const first = MOCK_DATA.contacts[MOCK_DATA.contacts.length - 1];
      await expect(page.locator('table').getByText(first.fullName).first()).toBeVisible();
    });

    test('should show client lookup labels', async ({ page }) => {
      await page.goto('/contacts');
      const first = MOCK_DATA.contacts[MOCK_DATA.contacts.length - 1];
      await expect(page.locator('table').getByText(first.clientId__label).first()).toBeVisible();
    });

    test('should filter by search', async ({ page }) => {
      await page.goto('/contacts');
      await page.getByPlaceholder('Search contacts...').fill('Alice');
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/search=Alice/);
    });

    test('should sort by name', async ({ page }) => {
      await page.goto('/contacts');
      await page.locator('th').getByText('Name').click();
      await expect(page).toHaveURL(/sort=fullName/);
    });

    test('should navigate to detail on name click', async ({ page }) => {
      await page.goto('/contacts');
      const first = MOCK_DATA.contacts[MOCK_DATA.contacts.length - 1];
      await page.locator('table').getByText(first.fullName).first().click();
      await expect(page).toHaveURL(new RegExp(`/contacts/${first.id}`));
    });
  });

  // ---------------------------------------------------------------------------
  // Quick Create
  // ---------------------------------------------------------------------------

  test.describe('Quick create', () => {
    test('should open quick create modal', async ({ page }) => {
      await page.goto('/contacts');
      await page.getByRole('button', { name: 'Add Contact' }).click();
      await expect(page.getByRole('heading', { name: 'Add Contact' })).toBeVisible();
    });

    test('should show name fields', async ({ page }) => {
      await page.goto('/contacts');
      await page.getByRole('button', { name: 'Add Contact' }).click();
      await expect(page.getByLabel('First Name')).toBeVisible();
      await expect(page.getByLabel('Last Name')).toBeVisible();
    });

    test('should submit and navigate to detail', async ({ page }) => {
      await page.goto('/contacts');
      await page.getByRole('button', { name: 'Add Contact' }).click();
      await page.getByLabel('First Name').fill('Test');
      await page.getByLabel('Last Name').fill('Contact');
      await page.getByRole('button', { name: 'Create Contact' }).click();
      await expect(page).toHaveURL(/\/contacts\/new-entity-001/);
    });
  });

  // ---------------------------------------------------------------------------
  // Detail Page
  // ---------------------------------------------------------------------------

  test.describe('Detail page', () => {
    test('should display contact name', async ({ page }) => {
      const contact = MOCK_DATA.contacts[0];
      await page.goto(`/contacts/${contact.id}`);
      await expect(page.getByText(contact.fullName).first()).toBeVisible();
    });

    test('should display sections', async ({ page }) => {
      const contact = MOCK_DATA.contacts[0];
      await page.goto(`/contacts/${contact.id}`);
      await expect(page.getByText('Contact Information')).toBeVisible();
    });

    test('should navigate back to list', async ({ page }) => {
      const contact = MOCK_DATA.contacts[0];
      await page.goto(`/contacts/${contact.id}`);
      const backLink = page.locator('a, button').filter({ hasText: 'Contacts' }).first();
      await backLink.click();
      await expect(page).toHaveURL('/contacts');
    });
  });
});
