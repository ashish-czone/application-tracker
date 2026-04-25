import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import type { DomainWebManifest, MenuItem, WebFeatureManifest } from '@packages/domains';
import type {
  ColumnRendererRegistration,
  DetailTabPlugin,
  HeaderPlugin,
  RightSidebarPanel,
} from '@packages/entity-engine-ui';
import type { ApiFn } from '@packages/platform-ui';

/**
 * Render function for per-entity header actions on EntityDetailPage —
 * keyed by entityType. The returned node is placed to the left of the
 * platform-default "Edit Layout" / workflow buttons.
 */
export type DetailHeaderActionRenderer = (
  entityId: string,
  entity: Record<string, unknown>,
) => ReactNode;

export type { ApiFn };

export interface WebShellOptions {
  /**
   * Domain manifests this app should mount. Each contributes routes,
   * detailPageOverrides, menuItems, and entityUIConfigs.
   */
  domains: DomainWebManifest[];
  /**
   * Authenticated fetch wrapper used by all UI packages. Each app provides
   * its own (typically createAuthenticatedApi from @packages/auth-ui).
   */
  apiFn: ApiFn;
  /**
   * Brand label rendered in the sidebar header (e.g. "Recruit", "Compliance").
   */
  brandLabel: string;
  /**
   * Frontend addon manifests this app should mount. Each contributes a
   * provider, routes, menu items, plugins, and column renderers in one
   * object — same posture as `domains`. Use this for `*-ui` addon packages
   * (taxonomy-ui, workflows-ui, automations-ui, ...) that need to
   * contribute UI without app-shell-ui importing them directly.
   */
  features?: WebFeatureManifest[];
  /**
   * App-level extra sidebar menu items. Use this for one-off entries that
   * don't belong in any reusable manifest. Addon-packaged menu entries
   * should ride on `features` instead.
   */
  extraMenuItems?: MenuItem[];
  /**
   * Addon-provided routes (Tasks page, Org Units page, ...) merged into
   * the protected route tree alongside platform routes.
   */
  extraRoutes?: RouteObject[];
  /**
   * Addon-provided EntityEngineProvider configs (e.g. TASKS_UI_CONFIG).
   * Concatenated with each domain's entityUIConfigs.
   */
  extraEntityUIConfigs?: unknown[];
  /**
   * Addon-provided detail tabs (Notes, Attachments, Evaluations, ...).
   */
  extraDetailTabs?: DetailTabPlugin[];
  /**
   * Addon-provided right sidebar panels.
   */
  extraRightSidebarPanels?: RightSidebarPanel[];
  /**
   * Addon-provided detail-page header plugins (tag chip rows, status banners,
   * etc.) rendered between the title block and the tabs.
   */
  extraHeaderPlugins?: HeaderPlugin[];
  /**
   * Extra column renderers (status badges, avatars, etc.). Merged into the
   * EntityEngineProvider column renderer registry.
   */
  extraColumnRenderers?: Record<string, ColumnRendererRegistration>;
  /**
   * Per-entity header action renderers for EntityDetailPage — e.g. an
   * "Open Editor" button for pages. Keyed by entityType. Rendered before
   * workflow actions and the default "Edit Layout" button.
   */
  extraDetailHeaderActions?: Record<string, DetailHeaderActionRenderer>;
}
