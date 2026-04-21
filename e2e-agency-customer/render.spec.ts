import { test, expect, type Route } from '@playwright/test';

/**
 * End-to-end smoke for the public agency customer portal: mock the pages-api, hit
 * the slug route, and assert the starter blocks render. Validates the
 * chain Next.js -> PageRenderer -> block registry -> block components
 * in a real browser without needing a DB or backend.
 */

interface SectionFixture {
  id: string;
  order: number;
  blockKind: string;
  variant: string | null;
  customFields: Record<string, unknown>;
}

interface PageFixture {
  id: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  ogImage: string | null;
}

function mockPage(page: PageFixture, sections: SectionFixture[]) {
  return async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ page, sections }),
    });
  };
}

test.describe('Agency site — slug route', () => {
  test('renders hero + text sections for the home slug', async ({ page }) => {
    await page.route('**/api/v1/public/pages/home', mockPage(
      {
        id: 'p1',
        slug: 'home',
        title: 'Welcome home',
        metaDescription: 'Our landing page',
        ogImage: null,
      },
      [
        {
          id: 's1',
          order: 0,
          blockKind: 'hero',
          variant: 'centered',
          customFields: { headline: 'Build faster', subheadline: 'With our platform' },
        },
        {
          id: 's2',
          order: 1,
          blockKind: 'text',
          variant: null,
          customFields: { heading: 'What we do', body: 'We ship software.' },
        },
      ],
    ));

    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Build faster');
    await expect(page.getByText('With our platform')).toBeVisible();
    await expect(page.locator('h2')).toHaveText('What we do');
    await expect(page.getByText('We ship software.')).toBeVisible();
  });

  test('respects section order regardless of input order', async ({ page }) => {
    await page.route('**/api/v1/public/pages/about', mockPage(
      {
        id: 'p2',
        slug: 'about',
        title: 'About',
        metaDescription: null,
        ogImage: null,
      },
      [
        { id: 's2', order: 1, blockKind: 'text', variant: null, customFields: { heading: 'Second' } },
        { id: 's1', order: 0, blockKind: 'text', variant: null, customFields: { heading: 'First' } },
      ],
    ));

    await page.goto('/about');
    const headings = page.locator('h2');
    await expect(headings.nth(0)).toHaveText('First');
    await expect(headings.nth(1)).toHaveText('Second');
  });

  test('404s when the API returns 404', async ({ page }) => {
    await page.route('**/api/v1/public/pages/missing', async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });

    const response = await page.goto('/missing');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Page not found')).toBeVisible();
  });
});
