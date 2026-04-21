import type { PublicPageResponse } from '@packages/pages-ui-frontend';

const API_BASE = process.env.PAGES_API_URL ?? 'http://localhost:3014';

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
