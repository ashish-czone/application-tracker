import { NavLink } from 'react-router';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEntityEngine } from './EntityEngineProvider';

interface EntityNavItemsProps {
  /** Whether the sidebar is collapsed (icon-only mode) */
  collapsed?: boolean;
  /** CSS class for each nav item */
  className?: (isActive: boolean) => string;
  /** CSS class for the icon */
  iconClassName?: string;
  /** CSS class for the label */
  labelClassName?: string;
}

/** Resolve a lucide icon name (e.g. 'users') to its component */
function resolveIcon(name: string): LucideIcon {
  // Convert kebab-case/lowercase to PascalCase (e.g. 'users' → 'Users', 'file-text' → 'FileText')
  const pascalCase = name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  const icon = (Icons as any)[pascalCase];
  return icon ?? Icons.Database;
}

/**
 * Auto-generates sidebar navigation items for all registered entities.
 * Reads the entity registry and renders NavLinks sorted by ui.navOrder.
 *
 * This component is designed to be rendered inside the app's sidebar
 * alongside manually-defined nav items (Dashboard, Settings, etc.).
 */
export function EntityNavItems({ collapsed, className, iconClassName, labelClassName }: EntityNavItemsProps) {
  const { entities, isLoading } = useEntityEngine();

  if (isLoading) return null;

  // Sort by navOrder, then by pluralName
  const sorted = [...entities].sort((a, b) => {
    const orderA = a.ui.navOrder ?? 99;
    const orderB = b.ui.navOrder ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.pluralName.localeCompare(b.pluralName);
  });

  const defaultClassName = (isActive: boolean) =>
    `group flex items-center gap-2.5 rounded-lg h-9 text-[13px] font-medium transition-colors duration-150 ${
      collapsed ? 'justify-center w-full' : 'px-2.5'
    } ${
      isActive
        ? 'bg-primary/[0.08] text-primary'
        : 'text-sidebar-muted hover:text-sidebar-foreground hover:bg-black/[0.03]'
    }`;

  return (
    <>
      {sorted.map((entity) => {
        const Icon = resolveIcon(entity.ui.icon);
        return (
          <NavLink
            key={entity.entityType}
            to={`/${entity.slug}`}
            className={({ isActive }) => (className ? className(isActive) : defaultClassName(isActive))}
            title={collapsed ? entity.pluralName : undefined}
          >
            <Icon className={iconClassName ?? 'w-4 h-4 shrink-0'} strokeWidth={1.75} />
            <span
              className={labelClassName ?? `transition-[opacity,width] duration-200 ${
                collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
              }`}
            >
              {entity.pluralName}
            </span>
          </NavLink>
        );
      })}
    </>
  );
}
