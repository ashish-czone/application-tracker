import { NavLink } from 'react-router';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEntityEngine } from './EntityEngineProvider';
import { groupSlug } from './helpers/groupSlug';
import type { EntityRegistryEntry } from './types';

interface EntityNavItemsProps {
  /** Whether the sidebar is collapsed (icon-only mode) */
  collapsed?: boolean;
  /** CSS class for each nav item */
  className?: (isActive: boolean) => string;
  /** CSS class for the icon */
  iconClassName?: string;
  /** CSS class for the label */
  labelClassName?: string;
  /** Entity types to exclude from auto-generation (e.g. ['tasks']) */
  exclude?: string[];
}

/** A top-level nav item — either a single entity or a collapsed tab group. */
type NavItem =
  | { kind: 'entity'; entity: EntityRegistryEntry; order: number }
  | {
      kind: 'group';
      navGroup: string;
      slug: string;
      icon: string | undefined;
      firstSlug: string;
      order: number;
      entityCount: number;
    };

/** Resolve a lucide icon name (e.g. 'users') to its component */
function resolveIcon(name: string | undefined): LucideIcon {
  if (!name) return Icons.Database;
  // Convert kebab-case/lowercase to PascalCase (e.g. 'users' → 'Users', 'file-text' → 'FileText')
  const pascalCase = name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  const icon = (Icons as any)[pascalCase];
  return icon ?? Icons.Database;
}

/**
 * Build the flat nav item list: entities with `groupRenderMode: 'tabs'` are
 * collapsed into a single per-group entry (ordered by the minimum `navOrder`
 * among its members). Entities without tabs-grouping pass through as-is.
 */
export function buildNavItems(entities: EntityRegistryEntry[]): NavItem[] {
  const groups = new Map<
    string,
    {
      navGroup: string;
      slug: string;
      members: EntityRegistryEntry[];
    }
  >();
  const singles: NavItem[] = [];

  for (const entity of entities) {
    if (entity.ui?.groupRenderMode === 'tabs' && entity.ui?.navGroup) {
      const slug = groupSlug(entity.ui.navGroup);
      const existing = groups.get(slug);
      if (existing) {
        existing.members.push(entity);
      } else {
        groups.set(slug, { navGroup: entity.ui.navGroup, slug, members: [entity] });
      }
    } else {
      singles.push({
        kind: 'entity',
        entity,
        order: entity.ui?.navOrder ?? 99,
      });
    }
  }

  const groupItems: NavItem[] = Array.from(groups.values()).map((group) => {
    const sortedMembers = [...group.members].sort((a, b) => {
      const orderA = a.ui?.navOrder ?? 99;
      const orderB = b.ui?.navOrder ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.pluralName.localeCompare(b.pluralName);
    });
    const first = sortedMembers[0];
    return {
      kind: 'group',
      navGroup: group.navGroup,
      slug: group.slug,
      icon: first.ui?.icon,
      firstSlug: first.slug,
      order: first.ui?.navOrder ?? 99,
      entityCount: sortedMembers.length,
    };
  });

  const all = [...singles, ...groupItems];
  all.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const labelA = a.kind === 'entity' ? a.entity.pluralName : a.navGroup;
    const labelB = b.kind === 'entity' ? b.entity.pluralName : b.navGroup;
    return labelA.localeCompare(labelB);
  });

  return all;
}

/**
 * Auto-generates sidebar navigation items for all registered entities.
 *
 * Entities with `ui: { groupRenderMode: 'tabs' }` sharing the same `navGroup`
 * are collapsed into a single link pointing at the tabbed group page
 * (`/{groupSlug}`). Other entities render as today — one NavLink per entity.
 */
export function EntityNavItems({ collapsed, className, iconClassName, labelClassName, exclude }: EntityNavItemsProps) {
  const { entities, isLoading } = useEntityEngine();

  if (isLoading) return null;

  const excludeSet = exclude ? new Set(exclude) : null;
  const filtered = excludeSet
    ? entities.filter((e) => !excludeSet.has(e.entityType))
    : entities;

  const items = buildNavItems(filtered);

  const defaultClassName = (isActive: boolean) =>
    `group flex items-center gap-2.5 rounded-lg h-9 text-[13px] font-medium transition-colors duration-150 ${
      collapsed ? 'justify-center w-full' : 'px-2.5'
    } ${
      isActive
        ? 'bg-primary/[0.08] text-primary'
        : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-black/[0.03]'
    }`;

  const renderLink = (key: string, to: string, icon: string | undefined, label: string) => {
    const Icon = resolveIcon(icon);
    return (
      <NavLink
        key={key}
        to={to}
        className={({ isActive }) => (className ? className(isActive) : defaultClassName(isActive))}
        title={collapsed ? label : undefined}
      >
        <Icon className={iconClassName ?? 'w-4 h-4 shrink-0'} strokeWidth={1.75} />
        <span
          className={labelClassName ?? `transition-[opacity,width] duration-200 ${
            collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
          }`}
        >
          {label}
        </span>
      </NavLink>
    );
  };

  return (
    <>
      {items.map((item) => {
        if (item.kind === 'entity') {
          return renderLink(
            item.entity.entityType,
            `/${item.entity.slug}`,
            item.entity.ui?.icon,
            item.entity.pluralName,
          );
        }
        return renderLink(
          `group:${item.slug}`,
          `/${item.slug}`,
          item.icon,
          item.navGroup,
        );
      })}
    </>
  );
}
