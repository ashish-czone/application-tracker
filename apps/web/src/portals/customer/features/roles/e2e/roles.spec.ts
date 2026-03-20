import { test, expect } from '../../../../../shared/auth/e2e/fixtures';

test.describe('Roles', () => {
  test.describe('List page', () => {
    test('should display roles list', async ({ authedPage: page }) => {
      await page.goto('/roles');
      await expect(page.getByRole('heading', { name: 'Roles' }).first()).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
      await expect(page.getByRole('button', { name: /add role/i })).toBeVisible();
    });

    test('should show seeded roles', async ({ authedPage: page }) => {
      await page.goto('/roles');
      await expect(page.getByRole('table').getByText('Admin').first()).toBeVisible();
      await expect(page.getByRole('table').getByText('Client').first()).toBeVisible();
    });

    test('should search roles by name', async ({ authedPage: page }) => {
      await page.goto('/roles');
      const mainContent = page.locator('main');
      const searchInput = mainContent.getByPlaceholder(/search/i).first();
      await searchInput.fill('Admin');
      await page.waitForTimeout(500);
      await expect(page.getByRole('table').getByText('Admin').first()).toBeVisible();

      await searchInput.fill('nonexistent-role-xyz');
      await page.waitForTimeout(500);
      await expect(page.getByText(/no.*results|no.*roles/i)).toBeVisible();
    });

    test('should filter by user type', async ({ authedPage: page }) => {
      await page.goto('/roles');
      const typeFilter = page.getByRole('combobox').first();
      if (await typeFilter.isVisible()) {
        await typeFilter.selectOption('client');
        await page.waitForTimeout(500);
      }
    });

    test('should show pagination info', async ({ authedPage: page }) => {
      await page.goto('/roles');
      await expect(page.getByText(/showing/i)).toBeVisible();
    });
  });

  test.describe('Add role', () => {
    test('should open add role modal', async ({ authedPage: page }) => {
      await page.goto('/roles');
      await page.getByRole('button', { name: /add role/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('should create a new role', async ({ authedPage: page }) => {
      await page.goto('/roles');
      await page.getByRole('button', { name: /add role/i }).click();

      const dialog = page.getByRole('dialog');
      await dialog.getByRole('textbox', { name: /name/i }).fill(`E2E Role ${Date.now()}`);

      const userTypeSelect = dialog.getByRole('combobox', { name: /user type/i });
      if (await userTypeSelect.isVisible()) {
        await userTypeSelect.selectOption('client');
      }

      // Handle multi-step (Next → permissions → Create) or single-step (Create)
      const nextButton = dialog.getByRole('button', { name: /next/i });
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
        // Select at least one permission checkbox
        const permCheckbox = dialog.locator('input[type="checkbox"]').first();
        if (await permCheckbox.isVisible()) {
          await permCheckbox.check();
        }
        const createButton = dialog.getByRole('button', { name: /create|save/i });
        if (await createButton.isVisible()) {
          await createButton.click();
        }
      } else {
        const createButton = dialog.getByRole('button', { name: /create|save/i });
        await createButton.click();
      }

      await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    });

    test('should show validation errors for empty form', async ({ authedPage: page }) => {
      await page.goto('/roles');
      await page.getByRole('button', { name: /add role/i }).click();
      const dialog = page.getByRole('dialog');

      const nextButton = dialog.getByRole('button', { name: /next/i });
      const createButton = dialog.getByRole('button', { name: /create|save/i });

      if (await nextButton.isVisible()) {
        await nextButton.click();
      } else if (await createButton.isVisible()) {
        await createButton.click();
      }
      await expect(page.getByText(/required|at least/i).first()).toBeVisible();
    });

    test('should close modal on cancel', async ({ authedPage: page }) => {
      await page.goto('/roles');
      await page.getByRole('button', { name: /add role/i }).click();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Edit role', () => {
    test('should open edit modal for non-system roles', async ({ authedPage: page }) => {
      await page.goto('/roles');
      const editButtons = page.getByRole('button', { name: /edit/i });
      if (await editButtons.count() > 0) {
        await editButtons.first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    });
  });

  test.describe('Delete role', () => {
    test('should show confirmation dialog', async ({ authedPage: page }) => {
      await page.goto('/roles');
      const deleteButtons = page.getByRole('button', { name: /delete/i });
      if (await deleteButtons.count() > 0) {
        await deleteButtons.first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    });
  });

  test.describe('Permissions', () => {
    test('should open permissions modal', async ({ authedPage: page }) => {
      await page.goto('/roles');
      const permButtons = page.getByRole('button', { name: /permission/i });
      if (await permButtons.count() > 0) {
        await permButtons.first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    });
  });
});
