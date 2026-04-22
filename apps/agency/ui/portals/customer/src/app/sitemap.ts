import type { MetadataRoute } from 'next';
import { fetchPublishedPages } from '@/lib/api';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:3100';

/**
 * Dynamic sitemap. Lists every published page returned by the
 * public pages-index endpoint. The home page is a synthetic entry
 * (the admin may not author a `home` slug, and / is the canonical
 * home URL regardless).
 *
 * Fails soft: if the API is unreachable at build time, returns just
 * the home entry rather than blowing up the whole sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const home = {
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 1,
  };

  let pages: Awaited<ReturnType<typeof fetchPublishedPages>> = [];
  try {
    pages = await fetchPublishedPages();
  } catch {
    return [home];
  }

  const entries = pages
    .filter((p) => p.slug !== 'home')
    .map((p) => ({
      url: `${SITE_URL}/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

  return [home, ...entries];
}
