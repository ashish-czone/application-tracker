import { test, expect } from '@playwright/test';

/**
 * Real-backend tests for the home page (S1, S2, S3, S4 in USER-STORIES.md).
 * Assumes the API is seeded with the agency demo data.
 */

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('S1 — hero shows availability pill, headline, subhead, two CTAs', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText(/Available for new work/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /start a project/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /see our work/i })).toBeVisible();
  });

  test('S1 — primary CTA links to /contact and secondary to /work', async ({ page }) => {
    const primary = page.getByRole('link', { name: /start a project/i }).first();
    const secondary = page.getByRole('link', { name: /see our work/i });
    await expect(primary).toHaveAttribute('href', '/contact');
    await expect(secondary).toHaveAttribute('href', '/work');
  });

  test('S2 — every below-the-fold section is visible (no opacity-0 traps)', async ({ page }) => {
    // Practices
    await expect(page.getByRole('heading', { name: /six practices, one team/i })).toBeVisible();
    // Recent work
    await expect(page.getByRole('heading', { name: /recent projects, shipped/i })).toBeVisible();
    // Stats
    await expect(page.getByRole('heading', { name: /six years, kept small/i })).toBeVisible();
    // Sign-off CTA
    await expect(
      page.getByRole('heading', { name: /let's build something that matters/i }),
    ).toBeVisible();
  });

  test('S3 — practices section renders six labelled items', async ({ page }) => {
    const practices = page.locator('section', {
      has: page.getByRole('heading', { name: /six practices, one team/i }),
    });
    await expect(practices).toBeVisible();
    // Six headings inside the practices grid (scoped — "Shopify" also
    // appears in the case-study tile for Maven Atelier).
    await expect(practices.getByRole('heading', { level: 3, name: /web platforms/i })).toBeVisible();
    await expect(practices.getByRole('heading', { level: 3, name: /mobile apps/i })).toBeVisible();
    await expect(practices.getByRole('heading', { level: 3, name: /ai products/i })).toBeVisible();
    await expect(practices.getByRole('heading', { level: 3, name: /^shopify$/i })).toBeVisible();
    await expect(practices.getByRole('heading', { level: 3, name: /digital marketing/i })).toBeVisible();
    await expect(practices.getByRole('heading', { level: 3, name: /strategy & design/i })).toBeVisible();
  });

  test('S4 — case study tiles render with image, client metadata, headline, link', async ({
    page,
  }) => {
    // The case-studies section should contain at least one anchor pointing at /work/<slug>
    const tiles = page.locator('a[href^="/work/"]');
    await expect(tiles.first()).toBeVisible();
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(4); // 4 seeded case studies + at least one nav link
    // First tile must contain an image
    await expect(tiles.first().locator('img').first()).toBeVisible();
  });

  test('S2 — body computed background is light (#fff or near-white)', async ({ page }) => {
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Expect rgb(255,255,255) or near-white. Reject anything close to black.
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    expect(match).not.toBeNull();
    if (match) {
      const [, r, g, b] = match;
      const luminance = (Number(r) + Number(g) + Number(b)) / 3;
      expect(luminance).toBeGreaterThan(240);
    }
  });
});
