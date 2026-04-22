'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import type { PublicMenuItemDto } from '@packages/menus-ui-frontend';
import { cn } from '@/lib/cn';

export interface HeaderShellProps {
  siteName: string;
  menuItems: PublicMenuItemDto[];
}

/**
 * Client-side shell for the site header. Owns:
 * - sticky scroll state (transparent over the top of the page,
 *   solid/blur once the user scrolls past ~40px)
 * - mobile drawer open/closed state + body scroll lock
 * - desktop dropdown hover state (CSS :hover still works; we use JS
 *   for focus-within-style keyboard support)
 *
 * Server component (SiteHeader) fetches the menu and passes items in
 * so this component stays flexible enough to be reused if another
 * site wants to pipe items from elsewhere (e.g. a static config).
 */
export function HeaderShell({ siteName, menuItems }: HeaderShellProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while the mobile drawer is open so the page
  // behind doesn't scroll with the drawer.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'backdrop-blur-md bg-[hsl(var(--background)/0.8)] border-b border-[hsl(var(--border))]'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 md:px-10 h-16 md:h-20">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight"
          aria-label={`${siteName} home`}
        >
          {siteName}
        </Link>

        <DesktopNav items={menuItems} />

        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <MobileDrawer open={open} items={menuItems} onClose={() => setOpen(false)} />
    </header>
  );
}

function DesktopNav({ items }: { items: PublicMenuItemDto[] }) {
  if (items.length === 0) return null;
  return (
    <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <DesktopItem key={item.id} item={item} />
        ))}
      </ul>
    </nav>
  );
}

function DesktopItem({ item }: { item: PublicMenuItemDto }) {
  const hasChildren = item.children.length > 0;
  const href = item.href ?? '#';
  const isExternal = /^https?:\/\//.test(href) || item.target === '_blank';

  const linkClasses =
    'px-3 py-2 rounded-md text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors';

  if (!hasChildren) {
    return (
      <li>
        {isExternal ? (
          <a
            href={href}
            target={item.target === '_blank' ? '_blank' : undefined}
            rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
            className={linkClasses}
          >
            {item.label}
          </a>
        ) : (
          <Link href={href} className={linkClasses}>
            {item.label}
          </Link>
        )}
      </li>
    );
  }

  return (
    <li className="relative group">
      <button
        type="button"
        className={cn(linkClasses, 'inline-flex items-center gap-1 group-hover:bg-[hsl(var(--muted))]')}
        aria-haspopup="true"
      >
        {item.label}
        <ChevronDown className="h-3 w-3 transition-transform group-hover:rotate-180" />
      </button>
      <div
        className={cn(
          'absolute left-0 top-full pt-2',
          'hidden group-hover:block group-focus-within:block',
        )}
      >
        <ul
          className={cn(
            'min-w-[220px] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-2',
            'shadow-lg shadow-black/5',
          )}
        >
          {item.children.map((child) => {
            const childHref = child.href ?? '#';
            const childExternal = /^https?:\/\//.test(childHref) || child.target === '_blank';
            return (
              <li key={child.id}>
                {childExternal ? (
                  <a
                    href={childHref}
                    target={child.target === '_blank' ? '_blank' : undefined}
                    rel={child.target === '_blank' ? 'noopener noreferrer' : undefined}
                    className="block px-3 py-2 rounded-md text-sm hover:bg-[hsl(var(--muted))]"
                  >
                    {child.label}
                  </a>
                ) : (
                  <Link
                    href={childHref}
                    className="block px-3 py-2 rounded-md text-sm hover:bg-[hsl(var(--muted))]"
                  >
                    {child.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

function MobileDrawer({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: PublicMenuItemDto[];
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        'md:hidden fixed inset-x-0 top-16 bottom-0 z-40 transition-transform duration-300',
        'bg-[hsl(var(--background))]',
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <nav className="px-6 py-8 h-full overflow-y-auto" aria-label="Primary mobile">
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <MobileItem key={item.id} item={item} onNavigate={onClose} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

function MobileItem({
  item,
  onNavigate,
}: {
  item: PublicMenuItemDto;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children.length > 0;
  const href = item.href ?? '#';
  const isExternal = /^https?:\/\//.test(href) || item.target === '_blank';

  if (!hasChildren) {
    return (
      <li>
        {isExternal ? (
          <a
            href={href}
            target={item.target === '_blank' ? '_blank' : undefined}
            rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
            onClick={onNavigate}
            className="block px-4 py-4 text-lg font-medium rounded-md hover:bg-[hsl(var(--muted))]"
          >
            {item.label}
          </a>
        ) : (
          <Link
            href={href}
            onClick={onNavigate}
            className="block px-4 py-4 text-lg font-medium rounded-md hover:bg-[hsl(var(--muted))]"
          >
            {item.label}
          </Link>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-4 text-lg font-medium rounded-md hover:bg-[hsl(var(--muted))]"
        aria-expanded={expanded}
      >
        {item.label}
        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <ul className="pl-4 pb-2 flex flex-col gap-1">
          {item.children.map((child) => {
            const childHref = child.href ?? '#';
            const childExternal = /^https?:\/\//.test(childHref) || child.target === '_blank';
            return (
              <li key={child.id}>
                {childExternal ? (
                  <a
                    href={childHref}
                    target={child.target === '_blank' ? '_blank' : undefined}
                    rel={child.target === '_blank' ? 'noopener noreferrer' : undefined}
                    onClick={onNavigate}
                    className="block px-4 py-3 text-base text-[hsl(var(--muted-foreground))] rounded-md hover:bg-[hsl(var(--muted))]"
                  >
                    {child.label}
                  </a>
                ) : (
                  <Link
                    href={childHref}
                    onClick={onNavigate}
                    className="block px-4 py-3 text-base text-[hsl(var(--muted-foreground))] rounded-md hover:bg-[hsl(var(--muted))]"
                  >
                    {child.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
