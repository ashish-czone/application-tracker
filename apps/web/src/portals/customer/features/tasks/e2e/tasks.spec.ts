import { test, expect } from '../../../../../shared/auth/e2e/fixtures';

test.describe('Tasks', () => {
  test.describe('List page', () => {
    test('should display tasks list with data grid', async ({ authedPage: page }) => {
      await page.goto('/tasks');
      await expect(page.getByRole('heading', { name: 'Tasks' }).first()).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
    });

    test('should search tasks by title', async ({ authedPage: page }) => {
      await page.goto('/tasks');
      // Find search input within main content area (not header search)
      const mainContent = page.locator('main');
      const searchInput = mainContent.getByPlaceholder(/search/i).first();
      await searchInput.fill('nonexistent-task-xyz');
      await page.waitForTimeout(500);
      await expect(page.getByText(/no.*results|no.*tasks/i)).toBeVisible();
    });

    test('should show pagination info', async ({ authedPage: page }) => {
      await page.goto('/tasks');
      await expect(page.getByText(/showing/i)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('Add task', () => {
    test('should open add task modal', async ({ authedPage: page }) => {
      await page.goto('/tasks');
      await page.getByRole('button', { name: 'Add Task' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('should create a new task', async ({ authedPage: page }) => {
      await page.goto('/tasks');
      await page.getByRole('button', { name: 'Add Task' }).first().click();

      const dialog = page.getByRole('dialog');
      await dialog.getByRole('textbox', { name: /title/i }).fill(`E2E Task ${Date.now()}`);

      const descField = dialog.locator('textarea').first();
      if (await descField.isVisible()) {
        await descField.fill('Test task created by e2e');
      }

      const prioritySelect = dialog.getByRole('combobox').first();
      if (await prioritySelect.isVisible()) {
        await prioritySelect.selectOption('medium');
      }

      await dialog.getByRole('button', { name: /create|save|add/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    });

    test('should show validation errors for empty form', async ({ authedPage: page }) => {
      await page.goto('/tasks');
      await page.getByRole('button', { name: 'Add Task' }).first().click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: /create|save|add/i }).click();
      await expect(page.getByText(/required|at least/i).first()).toBeVisible();
    });

    test('should close modal on cancel', async ({ authedPage: page }) => {
      await page.goto('/tasks');
      await page.getByRole('button', { name: 'Add Task' }).first().click();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Edit task', () => {
    test('should open edit modal', async ({ authedPage: page }) => {
      await page.goto('/tasks');
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
    });
  });

  test.describe('Delete task', () => {
    test('should show confirmation dialog', async ({ authedPage: page }) => {
      await page.goto('/tasks');
      const deleteButton = page.getByRole('button', { name: /delete/i }).first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/are you sure|confirm/i)).toBeVisible();
      }
    });
  });
});
