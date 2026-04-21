import Link from 'next/link';
import { MenuRenderer, type MenuLinkComponent } from '@packages/menus-ui-frontend';
import { fetchMenuBySlug } from '@/lib/api';

/**
 * Adapter from next/link to the MenuRenderer's MenuLinkComponent slot.
 * External URLs (anything that's not a same-origin path) fall back to a
 * plain <a> so next/link doesn't try to prefetch them.
 */
const NextLinkAdapter: MenuLinkComponent = ({ href, target, className, children }) => {
  const isExternal = /^https?:\/\//.test(href) || target === '_blank';
  if (isExternal) {
    return (
      <a
        href={href}
        target={target === '_blank' ? '_blank' : undefined}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
};

export async function SiteHeader({ slug = 'primary' }: { slug?: string }) {
  const menu = await fetchMenuBySlug(slug);

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Agency Site
        </Link>
        {menu && (
          <MenuRenderer
            items={menu.items}
            Link={NextLinkAdapter}
            className="text-sm"
            listClassName="flex items-center gap-6"
            itemClassName="group relative"
            linkClassName="text-zinc-700 hover:text-zinc-950"
            dropdownClassName="absolute left-0 top-full hidden min-w-[180px] flex-col gap-1 border border-zinc-200 bg-white p-2 shadow-md group-hover:flex"
          />
        )}
      </div>
    </header>
  );
}
