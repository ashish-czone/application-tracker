import { type ComponentType, type ReactNode } from 'react';
import type { PublicMenuItemDto } from './types';

/**
 * Minimal slot for rendering a single link. Host apps can pass `Link` from
 * their framework (`next/link`, `react-router`, or a plain anchor). The
 * default emits a plain `<a>` which is correct for static export and any
 * SSR framework — the host just trades it up for routing where needed.
 */
export type MenuLinkComponent = ComponentType<{
  href: string;
  target: '_self' | '_blank';
  className?: string;
  children: ReactNode;
}>;

const DefaultLink: MenuLinkComponent = ({ href, target, className, children }) => (
  <a
    href={href}
    target={target === '_blank' ? '_blank' : undefined}
    rel={target === '_blank' ? 'noopener noreferrer' : undefined}
    className={className}
  >
    {children}
  </a>
);

export interface MenuRendererProps {
  items: PublicMenuItemDto[];
  /** Host-provided link component — defaults to a plain `<a>`. */
  Link?: MenuLinkComponent;
  /** Tailwind class on the root <nav>. */
  className?: string;
  /** Tailwind class on the top-level <ul>. */
  listClassName?: string;
  /** Tailwind class on each child <ul> (dropdown). */
  dropdownClassName?: string;
  /** Tailwind class on each <li>. */
  itemClassName?: string;
  /** Tailwind class on each <a>. */
  linkClassName?: string;
  /** aria-label for the <nav> element. Defaults to "Main navigation". */
  ariaLabel?: string;
}

/**
 * Framework-agnostic renderer for the public menu tree returned by
 * GET /public/menus/:slug. Produces a semantic <nav><ul>…</ul></nav>
 * structure with native hover/focus affordances — styling is owned
 * entirely by the consumer through className props and the Link slot.
 */
export function MenuRenderer({
  items,
  Link = DefaultLink,
  className,
  listClassName,
  dropdownClassName,
  itemClassName,
  linkClassName,
  ariaLabel = 'Main navigation',
}: MenuRendererProps): ReactNode {
  if (items.length === 0) return null;

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul className={listClassName}>
        {items.map((item) => (
          <MenuItem
            key={item.id}
            item={item}
            Link={Link}
            itemClassName={itemClassName}
            linkClassName={linkClassName}
            dropdownClassName={dropdownClassName}
          />
        ))}
      </ul>
    </nav>
  );
}

function MenuItem({
  item,
  Link,
  itemClassName,
  linkClassName,
  dropdownClassName,
}: {
  item: PublicMenuItemDto;
  Link: MenuLinkComponent;
  itemClassName?: string;
  linkClassName?: string;
  dropdownClassName?: string;
}) {
  const hasChildren = item.children.length > 0;

  return (
    <li className={itemClassName}>
      {item.href ? (
        <Link href={item.href} target={item.target} className={linkClassName}>
          {item.label}
        </Link>
      ) : (
        <span className={linkClassName}>{item.label}</span>
      )}
      {hasChildren && (
        <ul className={dropdownClassName}>
          {item.children.map((child) => (
            <MenuItem
              key={child.id}
              item={child}
              Link={Link}
              itemClassName={itemClassName}
              linkClassName={linkClassName}
              dropdownClassName={dropdownClassName}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

