import type { SectionData } from '@domains/agency-contract';
import type { PublicMenuResponse } from '@packages/menus-ui-frontend';
import { DEFAULT_SITE_THEME, type SiteTheme } from '@domains/agency-contract';

/**
 * Shape the public-page API returns at `GET /api/v1/public/pages/:slug`.
 * Defined locally per the frontend-owns-its-types convention — the backend
 * DTO (`PublicPageResponse` in `@domains/agency-api`) is the authoritative
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

export interface PublicPageIndexEntry {
  slug: string;
  updatedAt: string;
  publishedAt: string;
}

export async function fetchPublishedPages(
  options: { revalidate?: number } = {},
): Promise<PublicPageIndexEntry[]> {
  const res = await fetch(`${API_BASE}/api/v1/public/pages`, {
    next: { revalidate: options.revalidate ?? 300, tags: ['pages:index'] },
  });
  if (!res.ok) {
    throw new Error(`fetchPublishedPages failed: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { pages: PublicPageIndexEntry[] };
  return body.pages ?? [];
}

/**
 * Shape returned by `GET /api/v1/public/site-settings`. Mirrors the
 * backend's `PublicSiteSettings` (derived from `PUBLIC_SITE_KEYS` in
 * `domains/agency/api/settings.ts`). All values are strings; empty
 * string = "not set".
 */
export interface SiteSettings {
  companyName: string;
  companyLogo: string;
  siteName: string;
  tagline: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  'social.twitter': string;
  'social.linkedin': string;
  'social.instagram': string;
  'social.github': string;
  'social.youtube': string;
  'defaultSeo.title': string;
  'defaultSeo.description': string;
  'defaultSeo.ogImage': string;
  'analytics.ga4': string;
  'analytics.posthog': string;
  theme: SiteTheme;
}

// Used when the API is unreachable (e.g., during a prerender before
// the API comes up). Kept aligned with SITE_DEFAULTS on the backend
// so the site still renders something sensible rather than blowing up.
const SITE_SETTINGS_FALLBACK: SiteSettings = {
  companyName: 'Studio',
  companyLogo: '',
  siteName: 'Studio',
  tagline: 'Brand-first design and technology',
  description: 'A studio building thoughtful digital products.',
  contactEmail: 'hello@example.com',
  contactPhone: '',
  address: '',
  'social.twitter': '',
  'social.linkedin': '',
  'social.instagram': '',
  'social.github': '',
  'social.youtube': '',
  'defaultSeo.title': '',
  'defaultSeo.description': '',
  'defaultSeo.ogImage': '',
  'analytics.ga4': '',
  'analytics.posthog': '',
  theme: DEFAULT_SITE_THEME,
};

export async function fetchSiteSettings(
  options: { revalidate?: number } = {},
): Promise<SiteSettings> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/site-settings`, {
      next: { revalidate: options.revalidate ?? 300, tags: ['site-settings'] },
    });
    if (!res.ok) return SITE_SETTINGS_FALLBACK;
    return (await res.json()) as SiteSettings;
  } catch {
    return SITE_SETTINGS_FALLBACK;
  }
}
