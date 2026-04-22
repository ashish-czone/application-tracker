import { fetchMenuBySlug } from '@/lib/api';
import { HeaderShell } from './header/HeaderShell';

/**
 * Server component: loads the `primary` menu and hands it to the
 * interactive header shell. Branding (siteName) is hardcoded for now
 * — F1 (site-settings addon) replaces it with a value read from the
 * DB. That swap will touch only this file.
 */
export async function SiteHeader({ slug = 'primary' }: { slug?: string }) {
  const menu = await fetchMenuBySlug(slug);
  const items = menu?.items ?? [];
  const siteName = 'Studio';
  return <HeaderShell siteName={siteName} menuItems={items} />;
}
