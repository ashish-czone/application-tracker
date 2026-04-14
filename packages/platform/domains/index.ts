import type { Type } from '@nestjs/common';
import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import type { LucideIcon } from 'lucide-react';

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
   * On conflict with an existing path, the first-registered route wins.
   */
  routes?: RouteObject[];
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
