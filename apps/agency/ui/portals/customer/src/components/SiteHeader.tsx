import { fetchMenuBySlug, fetchSiteSettings } from '@/lib/api';
import { HeaderShell } from './header/HeaderShell';

/**
 * Server component: loads the `primary` menu and public site settings,
 * then hands them to the interactive header shell. Both fetches are
 * parallelized; each has its own ISR cache tag.
 */
export async function SiteHeader({ slug = 'primary' }: { slug?: string }) {
  const [menu, settings] = await Promise.all([
    fetchMenuBySlug(slug),
    fetchSiteSettings(),
  ]);
  const items = menu?.items ?? [];
  return <HeaderShell siteName={settings.siteName} menuItems={items} />;
}
