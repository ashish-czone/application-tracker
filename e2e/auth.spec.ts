import { test, expect } from '@playwright/test';

const TEST_EMAIL = `e2e-${Date.now()}@example.com`;
const TEST_PASSWORD = 'E2eTestPass1!';

test.describe('Authentication', () => {
  test.describe.configure({ mode: 'serial' });

  test('should register a new user and redirect to dashboard', async ({ page }) => {
    await page.goto('/register');

    await page.getByRole('textbox', { name: 'Email' }).fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('textbox', { name: 'Confirm password' }).fill(TEST_PASSWORD);

    // Password strength meter should show strong
    await expect(page.getByText('strong')).toBeVisible();

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('should login with registered user and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: 'Email' }).fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: 'Email' }).fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill('WrongPassword1!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('should show validation errors on empty login submit', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/email is required/i)).toBeVisible();
  });

  test('should navigate between auth pages via links', async ({ page }) => {
    await page.goto('/login');

    // Login -> Register
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/register');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

    // Register -> Login
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // Login -> Forgot password
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Forgot password' })).toBeVisible();

    // Forgot password -> Login
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('should show forgot password success message', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.getByRole('textbox', { name: 'Email' }).fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Send reset link' }).click();

    await expect(page.getByRole('status')).toContainText('Check your email');
  });

  test('should preserve intended destination after login', async ({ browser }) => {
    // Use a fresh browser context so no cookies/tokens linger from prior tests
    const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page = await context.newPage();

    // Visit a protected page while unauthenticated
    await page.goto('/');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Login
    await page.getByRole('textbox', { name: 'Email' }).fill(TEST_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should return to the originally intended page
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await context.close();
  });
});
