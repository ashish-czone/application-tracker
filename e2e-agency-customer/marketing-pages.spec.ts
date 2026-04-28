import { test, expect } from '@playwright/test';

/**
 * Catch-all marketing pages (S9, S10 in USER-STORIES.md). Confirms each
 * route returns 200 and renders without server errors.
 */

const PAGES = [
  { path: '/about', heading: /about|small team|shipping work/i },
  { path: '/services', heading: /work we take on|practices|services/i },
  { path: '/contact', heading: /let's build|contact|conversation/i },
];

for (const { path, heading } of PAGES) {
  test(`S9 — ${path} returns 200 with rendered hero`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    // Heading text should contain something page-specific
    const h1 = await page.locator('h1').first().textContent();
    expect(h1?.toLowerCase()).toMatch(heading);
  });
}

test('S10 — /contact renders the placeholder form with disabled inputs', async ({ page }) => {
  await page.goto('/contact');
  // Form fields exist and are disabled
  const nameInput = page.getByLabel(/name/i).first();
  const emailInput = page.getByLabel(/email/i).first();
  const messageInput = page.getByLabel(/message/i).first();
  await expect(nameInput).toBeDisabled();
  await expect(emailInput).toBeDisabled();
  await expect(messageInput).toBeDisabled();
  // Submit button exists and is disabled
  const submit = page.getByRole('button', { name: /send message/i });
  await expect(submit).toBeDisabled();
});

test('S10 — /contact does not 500', async ({ page }) => {
  const response = await page.goto('/contact');
  expect(response?.status()).toBe(200);
});
