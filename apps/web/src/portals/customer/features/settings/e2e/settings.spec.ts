import { test, expect } from '../../../../../shared/auth/e2e/fixtures';

test.describe('Settings', () => {
  test('should display settings page', async ({ authedPage: page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible();
  });

  test('should show Authentication tab with settings', async ({ authedPage: page }) => {
    await page.goto('/settings');
    await expect(page.getByText(/authentication/i).first()).toBeVisible();
  });

  test('should display settings fields for a module', async ({ authedPage: page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: /authentication/i }).click();
    await expect(page.getByText(/access token/i)).toBeVisible();
  });

  test('should edit a setting and show overridden indicator', async ({ authedPage: page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: /authentication/i }).click();

    const firstInput = page.getByRole('textbox').first();
    if (await firstInput.isVisible()) {
      const originalValue = await firstInput.inputValue();
      await firstInput.fill('45m');
      await firstInput.press('Enter');
      await page.waitForTimeout(1000);

      await expect(page.getByText(/overridden/i).first()).toBeVisible();

      // Reset back
      await firstInput.fill(originalValue);
      await firstInput.press('Enter');
      await page.waitForTimeout(500);
    }
  });

  test('should show reset all button when settings are overridden', async ({ authedPage: page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: /authentication/i }).click();

    const firstInput = page.getByRole('textbox').first();
    if (await firstInput.isVisible()) {
      await firstInput.fill('99m');
      await firstInput.press('Enter');
      await page.waitForTimeout(1000);

      await expect(page.getByRole('button', { name: /reset.*default/i }).first()).toBeVisible();

      // Reset it back
      const resetButton = page.getByRole('button', { name: /reset.*default/i }).first();
      await resetButton.click();
      await page.waitForTimeout(500);
    }
  });
});
