import type { Type } from '@nestjs/common';
import type { ComponentType, ReactNode } from 'react';
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
 *
 * Set `parent: '/some-path'` to nest this item as a child of an existing
 * top-level item (typically the platform's `/management` group). The shell
 * merges child entries into the matching parent's children array. If no
 * parent matches, the item is rendered at top level. Parent items
 * themselves should not set `parent`.
 */
export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
  position?: 'before' | 'after';
  parent?: string;
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

/**
 * Provider component contributed by a frontend feature manifest. Receives
 * `apiFn` so the provider can wire its own data fetching, and renders
 * `children` underneath. Apps stack these via `WebShell.features` rather
 * than hand-composing a provider tree per app.
 */
export type WebFeatureProvider = ComponentType<{
  children: ReactNode;
  apiFn: unknown;
}>;

/**
 * A frontend contribution from a `*-ui` package. Mirrors `DomainWebManifest`
 * for addon packages: an addon exports one of these so the app passes it via
 * `WebShell.features` rather than wiring each piece (provider, routes,
 * menu items, plugins) by hand.
 *
 * Concrete plugin types (DetailTabPlugin, HeaderPlugin, etc.) live in
 * `@packages/entity-engine-ui` and are kept loose here as `unknown[]` /
 * `Record<string, unknown>` to avoid pulling that package into this
 * lightweight type module — the shell casts at the EntityEngineProvider
 * boundary.
 */
export interface WebFeatureManifest {
  /**
   * Identifier used for debugging / dedup. Should match the addon's package
   * suffix without the `-ui` (e.g. `taxonomy`, `workflows`, `automations`).
   */
  name: string;
  /**
   * Optional context provider. The shell wraps `children` with each enabled
   * feature's provider, innermost-first in registration order. Earlier
   * features therefore appear deeper in the tree (closer to children).
   */
  provider?: WebFeatureProvider;
  /**
   * Routes mounted under the authenticated app shell, same shape as
   * `DomainWebManifest.routes`.
   */
  routes?: DomainRouteObject[];
  /**
   * Sidebar menu items contributed by this feature. Concatenated after
   * domain items + platform items, before app-level extras.
   */
  menuItems?: MenuItem[];
  /**
   * Entity UI configs the feature contributes (e.g. cell renderers tied to
   * a specific entity type). Concatenated with domain + app configs.
   */
  entityUIConfigs?: DomainEntityUIConfig[];
  /** EntityDetailPage tabs. Cast to `DetailTabPlugin[]` at the boundary. */
  detailTabs?: unknown[];
  /** EntityDetailPage right-sidebar panels. Cast to `RightSidebarPanel[]`. */
  rightSidebarPanels?: unknown[];
  /** EntityDetailPage header plugins. Cast to `HeaderPlugin[]`. */
  headerPlugins?: unknown[];
  /**
   * Column renderers contributed by name. Merged into the EntityEngine
   * column-renderer registry; on key conflict, app-level extras win over
   * features (which win over domain-supplied defaults).
   */
  columnRenderers?: Record<string, unknown>;
}
