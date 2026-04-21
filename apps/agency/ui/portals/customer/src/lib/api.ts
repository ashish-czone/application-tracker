import type { SectionData } from '@packages/blocks-contract';
import type { PublicMenuResponse } from '@packages/menus-ui-frontend';

/**
 * Shape the public-page API returns at `GET /api/v1/public/pages/:slug`.
 * Defined locally per the frontend-owns-its-types convention — the backend
 * DTO (`PublicPageResponse` in `@packages/pages-api`) is the authoritative
 * source; this mirror keeps NestJS out of the Next.js bundle.
 */
export interface PageData {
  id: string;
  slug: string;
  title: string;
  metaDescription: string | null;
  ogImage: string | null;
}

export interface PublicPageResponse {
  page: PageData;
  sections: SectionData[];
}

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

export async function fetchMenuBySlug(
  slug: string,
  options: { revalidate?: number } = {},
): Promise<PublicMenuResponse | null> {
  const res = await fetch(`${API_BASE}/api/v1/public/menus/${encodeURIComponent(slug)}`, {
    next: { revalidate: options.revalidate ?? 60, tags: [`menu:${slug}`] },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`fetchMenuBySlug(${slug}) failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as PublicMenuResponse;
}
