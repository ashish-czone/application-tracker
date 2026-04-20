import type { MetadataRoute } from 'next';

/**
 * Minimal sitemap — the home page only, since the pages-api list
 * endpoint currently requires auth. A public `/api/v1/public/pages`
 * (slug-only, published-only) is a follow-up; once landed, swap the
 * static entry for a fetched list.
 */
const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3100';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
