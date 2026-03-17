import { test, expect } from '@playwright/test';
import { mockUsersApi } from './fixtures/mock-users';

test.describe('Users list page', () => {
  test.beforeEach(async ({ page }) => {
    await mockUsersApi(page);
  });

  // --- Navigation ---

  test('should navigate to users page from sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Users' }).click();
    await expect(page).toHaveURL('/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  });

  // --- Data loading ---

  test('should display users in the data grid', async ({ page }) => {
    await page.goto('/users');
    // Default sort is createdAt desc, so newest users appear first
    // User 51 = Adam Edwards, User 50 = Zara Collins
    await expect(page.locator('table').getByText('Adam Edwards')).toBeVisible();
    await expect(page.locator('table').getByText('Zara Collins')).toBeVisible();
  });

  test('should show pagination info', async ({ page }) => {
    await page.goto('/users');
    await expect(page.getByText(/Showing .* to .* of .* results/)).toBeVisible();
  });

  // --- Search ---

  test('should filter results by search query', async ({ page }) => {
    await page.goto('/users');
    await page.getByPlaceholder('Search by name or email...').fill('Adam');

    // Wait for debounced search to fire
    await page.waitForTimeout(500);

    await expect(page.locator('table').getByText('Adam Edwards')).toBeVisible();
    await expect(page).toHaveURL(/search=Adam/);
  });

  test('should clear search with X button', async ({ page }) => {
    await page.goto('/users?search=Adam');
    await page.getByLabel('Clear search').click();

    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/search=/);
  });

  // --- Sorting ---

  test('should sort by column when header is clicked', async ({ page }) => {
    await page.goto('/users');
    await page.locator('th').getByText('Name').click();

    await expect(page).toHaveURL(/sort=firstName/);
    await expect(page).toHaveURL(/order=asc/);
  });

  test('should toggle sort direction on second click', async ({ page }) => {
    await page.goto('/users?sort=firstName&order=asc');
    await page.locator('th').getByText('Name').click();

    await expect(page).toHaveURL(/order=desc/);
  });

  // --- Pagination ---

  test('should navigate to next page', async ({ page }) => {
    await page.goto('/users');
    await page.getByLabel('Next page').click();

    await expect(page).toHaveURL(/page=2/);
  });

  test('should navigate to last page', async ({ page }) => {
    await page.goto('/users');
    await page.getByLabel('Last page').click();

    await expect(page).toHaveURL(/page=3/);
  });

  test('should change page size', async ({ page }) => {
    await page.goto('/users');
    // Page size select is the one near "Rows per page" text
    const pageSizeSelect = page.getByText('Rows per page').locator('..').locator('select');
    await pageSizeSelect.selectOption('10');

    await expect(page).toHaveURL(/limit=10/);
  });

  test('should reset to page 1 when changing page size', async ({ page }) => {
    await page.goto('/users?page=2');
    const pageSizeSelect = page.getByText('Rows per page').locator('..').locator('select');
    await pageSizeSelect.selectOption('10');

    await expect(page).not.toHaveURL(/page=2/);
  });

  // --- Filtering ---

  test('should filter by user type', async ({ page }) => {
    await page.goto('/users');

    // The user type filter is the select with "All types" option
    const typeSelect = page.locator('select', { has: page.locator('option', { hasText: 'All types' }) });
    await typeSelect.selectOption('admin');

    await expect(page).toHaveURL(/userType=admin/);
    // Filter chip should appear
    await expect(page.getByText('Type: Admin')).toBeVisible();
  });

  test('should remove filter chip', async ({ page }) => {
    await page.goto('/users?userType=admin');

    await page.getByLabel('Remove').click();

    await expect(page).not.toHaveURL(/userType=/);
    await expect(page.getByText('Type: Admin')).not.toBeVisible();
  });

  // --- Column visibility ---

  test('should toggle column visibility', async ({ page }) => {
    await page.goto('/users');

    // Open columns dropdown
    await page.getByRole('button', { name: /Columns/ }).click();

    // Uncheck Email column
    const emailCheckbox = page.locator('label').filter({ hasText: 'Email' }).locator('input');
    await emailCheckbox.uncheck();

    // Close dropdown by clicking elsewhere
    await page.locator('body').click({ position: { x: 0, y: 0 } });

    // Email column header should be hidden
    await expect(page.locator('th').filter({ hasText: 'Email' })).not.toBeVisible();

    // Re-open dropdown and re-check
    await page.getByRole('button', { name: /Columns/ }).click();
    const emailCheckbox2 = page.locator('label').filter({ hasText: 'Email' }).locator('input');
    await emailCheckbox2.check();

    // Close and verify
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    await expect(page.locator('th').filter({ hasText: 'Email' })).toBeVisible();
  });

  // --- Empty state ---

  test('should show empty state when no results match search', async ({ page }) => {
    await page.goto('/users');
    await page.getByPlaceholder('Search by name or email...').fill('zzzznonexistent');

    await page.waitForTimeout(500);

    // Empty state uses the emptyState prop title
    await expect(page.getByText('No users yet')).toBeVisible();
  });

  // --- URL state preservation ---

  test('should preserve table state in URL on page reload', async ({ page }) => {
    await page.goto('/users?page=2&sort=firstName&order=asc&search=bob');

    // Verify search input is pre-filled
    await expect(page.getByPlaceholder('Search by name or email...')).toHaveValue('bob');

    // Verify URL params are preserved
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/sort=firstName/);
    await expect(page).toHaveURL(/order=asc/);
    await expect(page).toHaveURL(/search=bob/);
  });
});
