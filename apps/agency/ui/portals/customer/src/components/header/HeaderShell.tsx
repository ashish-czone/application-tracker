'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  Building,
  ChevronDown,
  Circle,
  Globe,
  Megaphone,
  Menu,
  Palette,
  Rocket,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Users,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { PublicMenuItemDto } from '@domains/agency-ui/portals/customer';
import { CzoneLogo } from '@domains/agency-ui/components/branding/CzoneLogo';
import { cn } from '@/lib/cn';
import { ThemeToggle } from './ThemeToggle';

/**
 * Curated icon name → component map. Names mirror the values offered in
 * the admin's MenuItemDialog icon select. Unknown / null values fall
 * back to a small dot so the layout doesn't shift between items.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  globe: Globe,
  smartphone: Smartphone,
  sparkles: Sparkles,
  'shopping-bag': ShoppingBag,
  megaphone: Megaphone,
  palette: Palette,
  rocket: Rocket,
  zap: Zap,
  wrench: Wrench,
  shield: Shield,
  users: Users,
  building: Building,
};

function resolveIcon(name: string | null): LucideIcon {
  if (!name) return Circle;
  return ICON_MAP[name] ?? Circle;
}

/**
 * True when `pathname` matches (or is a child of) `href`. External
 * URLs never match; the root href only matches the exact root.
 */
function isActivePath(pathname: string, href: string | null | undefined): boolean {
  if (!href) return false;
  if (/^https?:\/\//.test(href)) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  const pathname = usePathname() ?? '/';
  const toggleRef = useRef<HTMLButtonElement | null>(null);

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

  // Escape closes the drawer and returns focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
      <div
        className={cn(
          'mx-auto flex max-w-6xl items-center justify-between px-6 md:px-10 transition-[height] duration-300',
          scrolled ? 'h-14 md:h-16' : 'h-16 md:h-20',
        )}
      >
        <Link
          href="/"
          className="inline-flex items-center transition-transform duration-200 hover:scale-[1.02]"
          aria-label={`${siteName} home`}
        >
          <CzoneLogo size={scrolled ? 18 : 22} />
        </Link>

        <DesktopNav items={menuItems} pathname={pathname} />

        <div className="flex items-center gap-1">
          <ThemeToggle className="hidden md:inline-flex" />
          <button
            ref={toggleRef}
            type="button"
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-drawer"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <MobileDrawer
        open={open}
        items={menuItems}
        pathname={pathname}
        onClose={() => setOpen(false)}
      />
    </header>
  );
}

function DesktopNav({ items, pathname }: { items: PublicMenuItemDto[]; pathname: string }) {
  if (items.length === 0) return null;
  return (
    <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
      <ul className="flex items-center gap-1">
        {items.map((item) => (
          <DesktopItem key={item.id} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}

function DesktopItem({ item, pathname }: { item: PublicMenuItemDto; pathname: string }) {
  const hasChildren = item.children.length > 0;
  const href = item.href ?? '#';
  const isExternal = /^https?:\/\//.test(href) || item.target === '_blank';
  const active =
    isActivePath(pathname, item.href) ||
    item.children.some((c) => isActivePath(pathname, c.href));

  const linkClasses = cn(
    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
    active
      ? 'text-[hsl(var(--foreground))] bg-[hsl(var(--muted))]'
      : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
  );

  if (!hasChildren) {
    const ariaCurrent = active ? ('page' as const) : undefined;
    return (
      <li>
        {isExternal ? (
          <a
            href={href}
            target={item.target === '_blank' ? '_blank' : undefined}
            rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
            className={linkClasses}
            aria-current={ariaCurrent}
          >
            {item.label}
          </a>
        ) : (
          <Link href={href} className={linkClasses} aria-current={ariaCurrent}>
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
      <MegaMenuPanel item={item} pathname={pathname} />
    </li>
  );
}

/**
 * Wide flyout panel anchored to a parent menu item. Two-column grid of
 * children (icon tile + label + description) plus a featured CTA card
 * on the right rail. Centred under the trigger so a wide panel doesn't
 * crash into the viewport edge for items late in the nav.
 */
function MegaMenuPanel({ item, pathname }: { item: PublicMenuItemDto; pathname: string }) {
  const anyHasDescription = item.children.some((c) => c.description);
  return (
    <div
      className={cn(
        'absolute left-1/2 -translate-x-1/2 top-full pt-3',
        'hidden group-hover:block group-focus-within:block',
      )}
    >
      <div
        className={cn(
          'w-[760px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4',
          'shadow-xl shadow-black/5',
          'grid grid-cols-[minmax(0,1fr)_220px] gap-4',
        )}
      >
        <ul className={cn('grid gap-1', anyHasDescription ? 'grid-cols-2' : 'grid-cols-1')}>
          {item.children.map((child) => (
            <MegaMenuItem key={child.id} child={child} pathname={pathname} />
          ))}
        </ul>
        <FeaturedCtaCard parentLabel={item.label} />
      </div>
    </div>
  );
}

function MegaMenuItem({
  child,
  pathname,
}: {
  child: PublicMenuItemDto;
  pathname: string;
}) {
  const childHref = child.href ?? '#';
  const isExternal = /^https?:\/\//.test(childHref) || child.target === '_blank';
  const active = isActivePath(pathname, child.href);
  const Icon = resolveIcon(child.icon);
  const ariaCurrent = active ? ('page' as const) : undefined;

  const content = (
    <span className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-[hsl(var(--muted))]">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          'bg-[hsl(var(--skin-anchor)/0.12)] text-[hsl(var(--skin-anchor))]',
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-[hsl(var(--foreground))]">{child.label}</span>
        {child.description && (
          <span className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2">
            {child.description}
          </span>
        )}
      </span>
    </span>
  );

  return (
    <li>
      {isExternal ? (
        <a
          href={childHref}
          target={child.target === '_blank' ? '_blank' : undefined}
          rel={child.target === '_blank' ? 'noopener noreferrer' : undefined}
          aria-current={ariaCurrent}
          className={cn('block rounded-lg', active && 'bg-[hsl(var(--muted))]')}
        >
          {content}
        </a>
      ) : (
        <Link
          href={childHref}
          aria-current={ariaCurrent}
          className={cn('block rounded-lg', active && 'bg-[hsl(var(--muted))]')}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

function FeaturedCtaCard({ parentLabel }: { parentLabel: string }) {
  return (
    <aside
      className={cn(
        'flex flex-col justify-between gap-4 rounded-xl p-4',
        'bg-[hsl(var(--skin-anchor)/0.08)] border border-[hsl(var(--skin-anchor)/0.18)]',
      )}
      aria-label={`Featured action for ${parentLabel}`}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--skin-anchor))]">
          Not sure where to start?
        </span>
        <p className="text-sm text-[hsl(var(--foreground))]">
          Book a 30-minute call. We'll map your idea to the right practice.
        </p>
      </div>
      <Link
        href="/contact"
        className={cn(
          'inline-flex items-center gap-1.5 text-sm font-medium',
          'text-[hsl(var(--skin-anchor))] hover:underline underline-offset-4',
        )}
      >
        Book a call
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </aside>
  );
}

function MobileDrawer({
  open,
  items,
  pathname,
  onClose,
}: {
  open: boolean;
  items: PublicMenuItemDto[];
  pathname: string;
  onClose: () => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);

  // Move focus to the first interactive element inside the drawer on
  // open so keyboard users land somewhere sensible. Guarded behind
  // `open` so the focus doesn't jump on mount of the closed drawer.
  useEffect(() => {
    if (!open) return;
    const el = navRef.current?.querySelector<HTMLElement>('a, button');
    el?.focus();
  }, [open]);

  return (
    <div
      id="mobile-drawer"
      role="dialog"
      aria-modal={open ? 'true' : undefined}
      aria-label="Primary navigation"
      className={cn(
        'md:hidden fixed inset-x-0 top-16 bottom-0 z-40 transition-transform duration-300',
        'bg-[hsl(var(--background))]',
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <nav ref={navRef} className="px-6 py-8 h-full overflow-y-auto" aria-label="Primary mobile">
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <MobileItem key={item.id} item={item} pathname={pathname} onNavigate={onClose} />
          ))}
        </ul>
        <div className="mt-6 pt-6 border-t border-[hsl(var(--border))] flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-[hsl(var(--muted-foreground))]">Theme</span>
        </div>
      </nav>
    </div>
  );
}

function MobileItem({
  item,
  pathname,
  onNavigate,
}: {
  item: PublicMenuItemDto;
  pathname: string;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = item.children.length > 0;
  const href = item.href ?? '#';
  const isExternal = /^https?:\/\//.test(href) || item.target === '_blank';
  const active =
    isActivePath(pathname, item.href) ||
    item.children.some((c) => isActivePath(pathname, c.href));
  const ariaCurrent = active && !hasChildren ? ('page' as const) : undefined;

  const topClasses = cn(
    'block px-4 py-4 text-lg font-medium rounded-md',
    active ? 'bg-[hsl(var(--muted))]' : 'hover:bg-[hsl(var(--muted))]',
  );

  if (!hasChildren) {
    return (
      <li>
        {isExternal ? (
          <a
            href={href}
            target={item.target === '_blank' ? '_blank' : undefined}
            rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
            onClick={onNavigate}
            className={topClasses}
            aria-current={ariaCurrent}
          >
            {item.label}
          </a>
        ) : (
          <Link href={href} onClick={onNavigate} className={topClasses} aria-current={ariaCurrent}>
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
        className={cn(
          'w-full flex items-center justify-between px-4 py-4 text-lg font-medium rounded-md',
          active ? 'bg-[hsl(var(--muted))]' : 'hover:bg-[hsl(var(--muted))]',
        )}
        aria-expanded={expanded}
      >
        {item.label}
        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <ul className="pl-2 pb-2 flex flex-col gap-1">
          {item.children.map((child) => {
            const childHref = child.href ?? '#';
            const childExternal = /^https?:\/\//.test(childHref) || child.target === '_blank';
            const childActive = isActivePath(pathname, child.href);
            const childAriaCurrent = childActive ? ('page' as const) : undefined;
            const Icon = resolveIcon(child.icon);
            const childClasses = cn(
              'flex items-start gap-3 px-3 py-3 rounded-md',
              childActive
                ? 'bg-[hsl(var(--muted))]'
                : 'hover:bg-[hsl(var(--muted))]',
            );
            const inner = (
              <>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--skin-anchor)/0.12)] text-[hsl(var(--skin-anchor))]"
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-base font-medium text-[hsl(var(--foreground))]">
                    {child.label}
                  </span>
                  {child.description && (
                    <span className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
                      {child.description}
                    </span>
                  )}
                </span>
              </>
            );
            return (
              <li key={child.id}>
                {childExternal ? (
                  <a
                    href={childHref}
                    target={child.target === '_blank' ? '_blank' : undefined}
                    rel={child.target === '_blank' ? 'noopener noreferrer' : undefined}
                    onClick={onNavigate}
                    className={childClasses}
                    aria-current={childAriaCurrent}
                  >
                    {inner}
                  </a>
                ) : (
                  <Link
                    href={childHref}
                    onClick={onNavigate}
                    className={childClasses}
                    aria-current={childAriaCurrent}
                  >
                    {inner}
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
