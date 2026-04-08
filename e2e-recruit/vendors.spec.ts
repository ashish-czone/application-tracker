import { test, expect } from '@playwright/test';
import { setupAllMocks, MOCK_DATA } from './fixtures/setup';

test.describe('Vendors', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllMocks(page);
  });

  // ---------------------------------------------------------------------------
  // List Page
  // ---------------------------------------------------------------------------

  test.describe('List page', () => {
    test('should display page heading and add button', async ({ page }) => {
      await page.goto('/vendors');
      await expect(page.getByRole('heading', { name: 'Vendors' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Vendor' })).toBeVisible();
    });

    test('should display vendors in the data grid', async ({ page }) => {
      await page.goto('/vendors');
      const first = MOCK_DATA.vendors[MOCK_DATA.vendors.length - 1];
      await expect(page.locator('table').getByText(first.vendorName).first()).toBeVisible();
    });

    test('should filter by search', async ({ page }) => {
      await page.goto('/vendors');
      await page.getByPlaceholder('Search vendors...').fill('StaffPro');
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/search=StaffPro/);
    });

    test('should sort by vendor name', async ({ page }) => {
      await page.goto('/vendors');
      await page.locator('th').getByText('Vendor Name').click();
      await expect(page).toHaveURL(/sort=vendorName/);
    });

    test('should navigate to detail on name click', async ({ page }) => {
      await page.goto('/vendors');
      const first = MOCK_DATA.vendors[MOCK_DATA.vendors.length - 1];
      await page.locator('table').getByText(first.vendorName).first().click();
      await expect(page).toHaveURL(new RegExp(`/vendors/${first.id}`));
    });

    test('should show empty state when no results', async ({ page }) => {
      await page.goto('/vendors');
      await page.getByPlaceholder('Search vendors...').fill('zzzznonexistent');
      await page.waitForTimeout(500);
      await expect(page.getByText('No vendors yet')).toBeVisible();
    });
  });

  // ---------------------------------------------------------------------------
  // Quick Create
  // ---------------------------------------------------------------------------

  test.describe('Quick create', () => {
    test('should open quick create modal', async ({ page }) => {
      await page.goto('/vendors');
      await page.getByRole('button', { name: 'Add Vendor' }).click();
      await expect(page.getByRole('heading', { name: 'Add Vendor' })).toBeVisible();
    });

    test('should show vendor name field', async ({ page }) => {
      await page.goto('/vendors');
      await page.getByRole('button', { name: 'Add Vendor' }).click();
      await expect(page.getByLabel('Vendor Name')).toBeVisible();
    });

    test('should submit and navigate to detail', async ({ page }) => {
      await page.goto('/vendors');
      await page.getByRole('button', { name: 'Add Vendor' }).click();
      await page.getByLabel('Vendor Name').fill('New Vendor Agency');
      await page.getByRole('button', { name: 'Create Vendor' }).click();
      await expect(page).toHaveURL(/\/vendors\/new-entity-001/);
    });
  });

  // ---------------------------------------------------------------------------
  // Detail Page
  // ---------------------------------------------------------------------------

  test.describe('Detail page', () => {
    test('should display vendor name', async ({ page }) => {
      const vendor = MOCK_DATA.vendors[0];
      await page.goto(`/vendors/${vendor.id}`);
      await expect(page.getByText(vendor.vendorName).first()).toBeVisible();
    });

    test('should display sections', async ({ page }) => {
      const vendor = MOCK_DATA.vendors[0];
      await page.goto(`/vendors/${vendor.id}`);
      await expect(page.getByText('Vendor Information')).toBeVisible();
    });

    test('should navigate back to list', async ({ page }) => {
      const vendor = MOCK_DATA.vendors[0];
      await page.goto(`/vendors/${vendor.id}`);
      const backLink = page.locator('a, button').filter({ hasText: 'Vendors' }).first();
      await backLink.click();
      await expect(page).toHaveURL('/vendors');
    });
  });
});
