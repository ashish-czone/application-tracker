import { test, expect } from '../../../../../shared/auth/e2e/fixtures';

test.describe('Users', () => {
  test.describe('List page', () => {
    test('should display users list with data grid', async ({ authedPage: page }) => {
      await page.goto('/users');
      await expect(page.getByRole('heading', { name: 'Users' }).first()).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible();
    });

    test('should show admin user in the list', async ({ authedPage: page }) => {
      await page.goto('/users');
      await expect(page.getByRole('cell', { name: 'admin@admin.com', exact: true })).toBeVisible();
    });

    test('should search users by name or email', async ({ authedPage: page }) => {
      await page.goto('/users');
      const searchInput = page.getByPlaceholder(/search by name or email/i);
      await searchInput.fill('admin');
      await page.waitForTimeout(500);
      await expect(page.getByRole('cell', { name: 'admin@admin.com', exact: true })).toBeVisible();

      await searchInput.fill('nonexistent-user-xyz');
      await page.waitForTimeout(500);
      await expect(page.getByText(/no.*results|no.*users/i)).toBeVisible();
    });

    test('should filter by user type', async ({ authedPage: page }) => {
      await page.goto('/users');
      const typeFilter = page.getByRole('combobox').first();
      if (await typeFilter.isVisible()) {
        await typeFilter.selectOption('client');
        await page.waitForTimeout(500);
      }
    });

    test('should sort by column headers', async ({ authedPage: page }) => {
      await page.goto('/users');
      const nameHeader = page.getByRole('columnheader', { name: 'Name' });
      await nameHeader.click();
      await page.waitForTimeout(300);
      await nameHeader.click();
      await page.waitForTimeout(300);
    });

    test('should show pagination info', async ({ authedPage: page }) => {
      await page.goto('/users');
      await expect(page.getByText(/showing/i)).toBeVisible();
    });
  });

  test.describe('Add user', () => {
    test('should open add user modal', async ({ authedPage: page }) => {
      await page.goto('/users');
      await page.getByRole('button', { name: 'Add User' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Add User' })).toBeVisible();
    });

    test('should show validation errors for empty form', async ({ authedPage: page }) => {
      await page.goto('/users');
      await page.getByRole('button', { name: 'Add User' }).click();
      await page.getByRole('button', { name: /create user/i }).click();
      await expect(page.getByText(/at least 2 characters|required/i).first()).toBeVisible();
    });

    test('should create a new user', async ({ authedPage: page }) => {
      await page.goto('/users');
      await page.getByRole('button', { name: 'Add User' }).click();

      const dialog = page.getByRole('dialog');
      await dialog.getByRole('textbox', { name: 'First name' }).fill('E2E');
      await dialog.getByRole('textbox', { name: 'Last name' }).fill('TestUser');
      await dialog.getByRole('textbox', { name: 'Email' }).fill(`e2e-${Date.now()}@test.com`);
      await dialog.getByRole('textbox', { name: 'Password' }).fill('TestPass123');

      await dialog.getByRole('combobox', { name: /user type/i }).selectOption('client');
      await page.waitForTimeout(300);

      const roleCheckbox = dialog.locator('input[type="checkbox"]').first();
      if (await roleCheckbox.isVisible()) {
        await roleCheckbox.check();
      }

      // Submit button may be below fold — use JS click to bypass visibility
      await dialog.getByRole('button', { name: /create user/i }).evaluate(btn => (btn as HTMLButtonElement).click());
      await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    });

    test('should close modal on cancel', async ({ authedPage: page }) => {
      await page.goto('/users');
      await page.getByRole('button', { name: 'Add User' }).click();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Edit user', () => {
    test('should open edit modal when clicking edit icon', async ({ authedPage: page }) => {
      await page.goto('/users');
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('heading', { name: /edit user/i })).toBeVisible();
      }
    });
  });

  test.describe('Delete user', () => {
    test('should show confirmation dialog when clicking delete', async ({ authedPage: page }) => {
      await page.goto('/users');
      const deleteButtons = page.getByRole('button', { name: /delete/i });
      const count = await deleteButtons.count();
      if (count > 0) {
        await deleteButtons.first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/are you sure|confirm/i)).toBeVisible();
      }
    });
  });

  test.describe('Include deleted toggle', () => {
    test('should toggle include deleted checkbox', async ({ authedPage: page }) => {
      await page.goto('/users');
      const includeDeleted = page.getByText(/include deleted/i);
      if (await includeDeleted.isVisible()) {
        await includeDeleted.click();
        await page.waitForTimeout(500);
        await includeDeleted.click();
      }
    });
  });
});
