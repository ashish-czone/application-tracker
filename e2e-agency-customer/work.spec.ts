import { test, expect } from '@playwright/test';

/**
 * Real-backend tests for the /work index, /work/[slug] detail, and the
 * industry filter (S5, S6, S7, S8 in USER-STORIES.md).
 */

test.describe('Work index', () => {
  test('S5 — /work shows hero + at least one case study card', async ({ page }) => {
    await page.goto('/work');
    await expect(page.getByRole('heading', { level: 1, name: /recent projects, shipped/i })).toBeVisible();
    const cards = page.locator('a[href^="/work/"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('S5 — case-study count pill reflects actual cards', async ({ page }) => {
    await page.goto('/work');
    const pillText = await page.getByText(/Selected work · \d+ case stud/i).textContent();
    expect(pillText).toBeTruthy();
    const match = pillText?.match(/(\d+) case stud/);
    expect(match).not.toBeNull();
    const expected = Number(match?.[1] ?? '0');
    const cards = page.locator('a[href^="/work/"]');
    expect(await cards.count()).toBe(expected);
  });

  test('S6 — clicking an industry chip narrows results and updates URL', async ({ page }) => {
    await page.goto('/work');
    // Find any industry chip other than "All"
    const allChip = page.getByRole('link', { name: 'All', exact: true });
    await expect(allChip).toBeVisible();
    const chip = page.locator('a[href^="/work?industry="]').first();
    const chipLabel = await chip.textContent();
    await chip.click();
    await expect(page).toHaveURL(/industry=/);
    // The remaining cards must all carry that industry text
    if (chipLabel) {
      const cards = page.locator('a[href^="/work/"]');
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(cards.nth(i)).toContainText(chipLabel);
      }
    }
  });

  test('S6 — "All" chip resets the filter', async ({ page }) => {
    await page.goto('/work?industry=Healthcare');
    const allChip = page.getByRole('link', { name: 'All', exact: true });
    await allChip.click();
    await expect(page).toHaveURL(/\/work$/);
  });
});

test.describe('Case study detail', () => {
  test('S7 — first case study renders headline, summary, hero image, body', async ({ page }) => {
    await page.goto('/work');
    const firstHref = await page.locator('a[href^="/work/"]').first().getAttribute('href');
    expect(firstHref).toBeTruthy();
    await page.goto(firstHref!);

    // Headline (h1)
    await expect(page.locator('h1')).toBeVisible();
    // Hero image
    await expect(page.locator('main img').first()).toBeVisible();
    // Results heading
    await expect(page.getByRole('heading', { name: /results/i })).toBeVisible();
    // Closing CTA
    await expect(page.getByRole('link', { name: /start a project/i })).toBeVisible();
  });

  test('S7 — JSON-LD Article schema is in the head', async ({ page }) => {
    await page.goto('/work');
    const firstHref = await page.locator('a[href^="/work/"]').first().getAttribute('href');
    await page.goto(firstHref!);
    // Two ld+json scripts on this page: site-wide Organization + per-study
    // Article. Pick the Article one explicitly.
    const allLdTexts = await page.locator('script[type="application/ld+json"]').allTextContents();
    const article = allLdTexts.map((t) => JSON.parse(t)).find((d) => d['@type'] === 'Article');
    expect(article, 'no Article JSON-LD on case study detail').toBeDefined();
    expect(article!.headline).toBeTruthy();
  });

  test('S8 — back link "All work" returns to /work', async ({ page }) => {
    await page.goto('/work');
    const firstHref = await page.locator('a[href^="/work/"]').first().getAttribute('href');
    await page.goto(firstHref!);
    await page.getByRole('link', { name: /all work/i }).click();
    await expect(page).toHaveURL(/\/work$/);
  });
});
