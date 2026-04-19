import type { Type } from '@nestjs/common';
import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import type { LucideIcon } from 'lucide-react';

/**
 * Route contributed by a domain manifest. Extends react-router's `RouteObject`
 * with an optional `permission` string. When set, the app shell wraps the
 * route in a permission guard that renders a Forbidden page if the current
 * user lacks the permission. Auth itself is enforced one level up by the
 * shell's AuthGuard — `permission` only controls finer-grained access.
 *
 * Set `bareLayout: true` to render the route without the platform `AppLayout`
 * chrome (sidebar + top bar). Use for screens that bring their own full-page
 * layout. AuthGuard + PermissionGuard still apply.
 */
export type DomainRouteObject = RouteObject & {
  permission?: string;
  bareLayout?: boolean;
};

export interface DomainBackendManifest {
  name: string;
  displayName: string;
  module: Type<unknown>;
}

/**
 * Detail page override component. Receives the entity record from EntityDetailPage.
 * Matches the EntityDetailPage shape so domain components can drop into the generic slot.
 */
export type DomainDetailPageComponent = ComponentType<Record<string, never>>;

/**
 * Sidebar menu entry contributed by a domain (or the platform shell).
 * Position controls whether the item renders before or after auto-generated
 * entity nav items. Children render as a collapsible group.
 */
export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  position?: 'before' | 'after';
  children?: MenuItem[];
}

/**
 * Entity UI config registered with the EntityEngineProvider. Kept loose
 * (`unknown`) here because the concrete shape lives in
 * `@packages/entity-engine-ui` and is heavyweight to type from this layer.
 */
export type DomainEntityUIConfig = unknown;

export interface DomainWebManifest {
  name: string;
  displayName: string;
  /**
   * Routes mounted under the authenticated app shell.
   * Each route's element should be a React.lazy component so domain code is code-split.
   * Set `permission` on a route to gate it behind a specific RBAC permission;
   * users without it see a Forbidden page instead of the route content.
   * On conflict with an existing path, the first-registered route wins.
   */
  routes?: DomainRouteObject[];
  /**
   * Override the generic EntityDetailPage for specific entity types, keyed by entityType.
   * The override component is rendered in place of EntityDetailPage on `/{slug}/:id`.
   * On conflict, the first-registered domain wins.
   */
  detailPageOverrides?: Record<string, DomainDetailPageComponent>;
  /**
   * Sidebar menu items contributed by this domain. Merged with platform
   * shell items. First-registered wins on path conflict.
   */
  menuItems?: MenuItem[];
  /**
   * Entity UI configs (column overrides, custom create forms, etc.) the
   * EntityEngineProvider should register. The shell concatenates configs
   * across all enabled domains.
   */
  entityUIConfigs?: DomainEntityUIConfig[];
}
