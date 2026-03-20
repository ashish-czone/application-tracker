import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('should show login form', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL('/');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('textbox', { name: 'Email' }).fill('wrong@example.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page.getByText(/invalid|incorrect|unauthorized/i)).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: 'Log in' }).click();
      await expect(page.getByText(/email|required/i).first()).toBeVisible();
    });
  });

  test.describe('Route protection', () => {
    test('should redirect to login when accessing /users without auth', async ({ page }) => {
      await page.goto('/users');
      await expect(page).toHaveURL('/login');
    });

    test('should redirect to login when accessing /tasks without auth', async ({ page }) => {
      await page.goto('/tasks');
      await expect(page).toHaveURL('/login');
    });

    test('should redirect authenticated user from /login to /', async ({ page }) => {
      await login(page);
      await page.goto('/login');
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Register', () => {
    test('should show register form', async ({ page }) => {
      await page.goto('/register');
      await expect(page.getByRole('heading', { name: /create|register|sign up/i })).toBeVisible();
    });

    test('should have link to login from register', async ({ page }) => {
      await page.goto('/register');
      await expect(page.getByRole('link', { name: /log in|sign in/i })).toBeVisible();
    });
  });

  test.describe('Forgot password', () => {
    test('should show forgot password form', async ({ page }) => {
      await page.goto('/forgot-password');
      await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    });

    test('should navigate from login to forgot password', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('link', { name: /forgot/i }).click();
      await expect(page).toHaveURL('/forgot-password');
    });
  });

  test.describe('Navigation', () => {
    test('should show sidebar with all menu items after login', async ({ page }) => {
      await login(page);
      await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Roles' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Tasks' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Workflows' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    });
  });
});
