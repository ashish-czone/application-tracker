import { test, expect } from '@playwright/test';

/**
 * Navigation, footer, 404, and resilience (S11–S15 in USER-STORIES.md).
 */

test.describe('Header navigation', () => {
  test('S11 — primary nav links navigate without errors', async ({ page }) => {
    await page.goto('/');
    // Brand mark links to /
    await expect(page.getByRole('link', { name: /studio home/i })).toHaveAttribute('href', '/');
    // Click each top-level link (Services, Work, About, Contact) and check URL
    await page.getByRole('link', { name: 'Work', exact: true }).click();
    await expect(page).toHaveURL(/\/work$/);

    await page.goto('/');
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await expect(page).toHaveURL(/\/about$/);

    await page.goto('/');
    await page.getByRole('link', { name: 'Contact', exact: true }).click();
    await expect(page).toHaveURL(/\/contact$/);
  });
});

test.describe('Footer', () => {
  test('S12 — footer shows brand block + contact email', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    // Email link
    await expect(footer.getByRole('link', { name: /@/i }).first()).toBeVisible();
  });

  test('S12 — footer Contact column is not empty when shown', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    const contactColumn = footer.getByRole('heading', { name: /contact/i }).locator('..');
    // Either the heading is absent (footer brand block carries the email)
    // or the column under it has at least one item.
    if (await contactColumn.count()) {
      const items = contactColumn.locator('a, p').filter({ hasText: /@|.+/ });
      await expect(items.first()).toBeVisible();
    }
  });
});

test.describe('404', () => {
  test('S13 — non-existent slug returns HTTP 404 + page-not-found UI', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-xyz');
    expect(response?.status()).toBe(404);
    // Heading uses a curly apostrophe (’), so match the prefix only.
    await expect(page.getByRole('heading', { name: /this page doesn/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();
  });
});

test.describe('Resilience', () => {
  for (const path of ['/', '/work', '/about', '/services', '/contact']) {
    test(`S14 — ${path} produces no console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        // Ignore network 404s for static assets we don't ship (e.g. favicon).
        if (/Failed to load resource.*404.*favicon/i.test(text)) return;
        errors.push(text);
      });
      page.on('pageerror', (err) => errors.push(String(err)));
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(errors, `unexpected console errors on ${path}: ${errors.join(' | ')}`).toEqual([]);
    });
  }

  test('S15 — light theme is applied even when prefers-color-scheme: dark', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('/');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).not.toBeNull();
    if (match) {
      const [, r, g, b] = match;
      const luminance = (Number(r) + Number(g) + Number(b)) / 3;
      expect(luminance, `body bg is ${bg}; expected near-white`).toBeGreaterThan(240);
    }
    await ctx.close();
  });
});
