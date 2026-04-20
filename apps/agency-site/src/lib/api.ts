import type { PublicPageResponse } from '@packages/pages-ui-frontend';

/**
 * Base URL of the pages-api (apps/api). Set in .env as PAGES_API_URL;
 * falls back to http://localhost:3000 for local dev.
 */
const API_BASE = process.env.PAGES_API_URL ?? 'http://localhost:3000';

export async function fetchPageBySlug(
  slug: string,
  options: { revalidate?: number } = {},
): Promise<PublicPageResponse | null> {
  const res = await fetch(`${API_BASE}/api/v1/public/pages/${encodeURIComponent(slug)}`, {
    next: { revalidate: options.revalidate ?? 60, tags: [`page:${slug}`] },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`fetchPageBySlug(${slug}) failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as PublicPageResponse;
}
