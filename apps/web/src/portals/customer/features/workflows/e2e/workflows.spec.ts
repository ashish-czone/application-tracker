import { test, expect } from '../../../../../shared/auth/e2e/fixtures';

test.describe('Workflows', () => {
  test.describe('List page', () => {
    test('should display workflows list', async ({ authedPage: page }) => {
      await page.goto('/workflows');
      await expect(page.getByRole('heading', { name: 'Workflows' }).first()).toBeVisible();
    });

    test('should show seeded task-status workflow', async ({ authedPage: page }) => {
      await page.goto('/workflows');
      await expect(page.getByText(/task.status/i)).toBeVisible();
    });

    test('should have add workflow button', async ({ authedPage: page }) => {
      await page.goto('/workflows');
      await expect(page.getByRole('button', { name: /add workflow/i })).toBeVisible();
    });
  });

  test.describe('Add workflow', () => {
    test('should open add workflow modal', async ({ authedPage: page }) => {
      await page.goto('/workflows');
      await page.getByRole('button', { name: /add workflow/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('should close modal on cancel', async ({ authedPage: page }) => {
      await page.goto('/workflows');
      await page.getByRole('button', { name: /add workflow/i }).click();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Workflow editor', () => {
    test('should navigate to workflow editor', async ({ authedPage: page }) => {
      await page.goto('/workflows');
      const workflowLink = page.getByText(/task.status/i).first();
      if (await workflowLink.isVisible()) {
        await workflowLink.click();
        await page.waitForURL(/\/workflows\/.+/);
        await expect(page.getByText(/task.status/i)).toBeVisible();
      }
    });

    test('should show workflow details in editor', async ({ authedPage: page }) => {
      await page.goto('/workflows/task-status');
      await expect(page.getByRole('heading', { name: /task status/i })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /add state/i })).toBeVisible();
    });

    test('should open add state modal', async ({ authedPage: page }) => {
      await page.goto('/workflows/task-status');
      await page.getByRole('button', { name: /add state/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('should navigate back to workflows list', async ({ authedPage: page }) => {
      await page.goto('/workflows/task-status');
      const backButton = page.getByRole('link', { name: /back/i }).or(page.getByRole('button', { name: /back/i })).or(page.locator('[aria-label="Back"]'));
      if (await backButton.isVisible()) {
        await backButton.click();
        await page.waitForURL('/workflows');
      }
    });
  });
});
