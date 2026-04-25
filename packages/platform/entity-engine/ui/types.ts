import type { ComponentType } from 'react';
import type { PaginatedResponse } from '@packages/common';

/** Matches EntityRegistryEntry from the backend */
export interface EntityRegistryEntry {
  entityType: string;
  singularName: string;
  pluralName: string;
  slug: string;
  ui: {
    icon: string;
    nameField: string | string[];
    subtitleField?: string;
    navGroup?: string;
    navOrder?: number;
    groupRenderMode?: 'tabs';
    createMode?: 'modal' | 'page' | 'wizard';
    boardFields?: string[];
    afterCreateRoute?: string;
  };
  /**
   * Engine-derived flags merged with the entity's opaque addon `features` bag.
   * Engine keys are typed below; addon keys come from `EntityConfig.features`
   * verbatim and are read by the addons that own them via their own readers.
   */
  features: {
    softDelete: boolean;
    restore: boolean;
    /** Entity exposes DB-backed definitions that admins can customize via the admin UI. */
    adminConfigurable: boolean;
    hasTaxonomy: boolean;
    hasWorkflow: boolean;
    hasMedia: boolean;
    workflowDiscriminator?: {
      key: string;
      label: string;
      options: { value: string; label: string }[];
      fieldName: string;
    } | null;
    [key: string]: unknown;
  };
  relationships: {
    name: string;
    type: 'hasMany' | 'belongsTo' | 'hasOne' | 'manyToMany';
    targetEntity: string;
    foreignKey?: string;
    label: string;
    displayFields?: string[];
  }[];
}

/** API client for a single entity */
export interface EntityApi {
  list: (params: Record<string, unknown>) => Promise<PaginatedResponse<Record<string, unknown>>>;
  get: (id: string) => Promise<Record<string, unknown>>;
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  delete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<Record<string, unknown>>;
  clone: (id: string) => Promise<Record<string, unknown>>;
}

/** Plugin section rendered on entity detail page */
export interface EntityDetailPlugin {
  component: ComponentType<{ entity: Record<string, unknown> }>;
  label: string;
  order: number;
}

/** Tab plugin for entity detail pages */
export interface DetailTabPlugin {
  /** Unique tab key */
  key: string;
  /** Display label */
  label: string;
  /** Sort order (lower = earlier). Overview is always 0. */
  order: number;
  /** Component rendered when this tab is active */
  component: ComponentType<{ entityType: string; entityId: string }>;
  /**
   * Predicate that decides whether this tab applies to a given entity. Read
   * the entity's opaque `features` bag (via the owning addon's reader) and
   * return true to show the tab. Omit to show on every entity.
   */
  enabledFor?: (entity: EntityRegistryEntry) => boolean;
}

/** Custom view mode for entity list pages (e.g. calendar, map, timeline) */
export interface ListViewPlugin {
  /** Unique view key (used in ?view=<key> URL param) */
  key: string;
  /** Display label (shown in the view toggle) */
  label: string;
  /** Optional lucide icon component */
  icon?: ComponentType<{ className?: string }>;
  /** Sort order relative to other plugin views (table/board are hardcoded and render first) */
  order: number;
  /** Component rendered when this view is active. Receives the entity type; should fetch records via useEntityHooks. */
  component: ComponentType<{ entityType: string }>;
  /**
   * Predicate that decides whether this view applies to a given entity.
   * Read the entity's opaque `features` bag (via the owning addon's reader)
   * and return true to show the view. Omit to show on every entity.
   */
  enabledFor?: (entity: EntityRegistryEntry) => boolean;
}

/** Panel rendered in the right sidebar of entity detail pages */
export interface RightSidebarPanel {
  /** Unique panel key */
  key: string;
  /** Display label shown as section header */
  label: string;
  /** Component rendered inside the panel */
  component: ComponentType<{ entityType: string; entityId: string }>;
  /** Sort order (lower = higher on page) */
  order: number;
  /**
   * Predicate that decides whether this panel applies to a given entity.
   * Read the entity's opaque `features` bag (via the owning addon's reader)
   * and return true to show the panel. Omit to show on every entity.
   */
  enabledFor?: (entity: EntityRegistryEntry) => boolean;
  /** Whether the panel starts collapsed */
  defaultCollapsed?: boolean;
}

/**
 * Plugin rendered in the entity detail-page header (e.g. tag chip rows,
 * status banners, ownership ribbons). Sits between the title block and the
 * tabs. Plugins read the entity row + opaque feature bag and decide whether
 * to render via `enabledFor`.
 */
export interface HeaderPlugin {
  /** Unique plugin key */
  key: string;
  /** Component rendered. Receives the entity type, id, and the loaded row. */
  component: ComponentType<{ entityType: string; entityId: string; entity: Record<string, unknown> }>;
  /** Sort order (lower = first) */
  order: number;
  /**
   * Predicate that decides whether this header plugin applies to the entity.
   * Omit to render on every entity.
   */
  enabledFor?: (entity: EntityRegistryEntry) => boolean;
}

/** Frontend-side entity UI config (supplements the backend registry) */
export interface EntityUIConfig {
  entityType: string;
  detailPlugins?: EntityDetailPlugin[];
  /** Entity-specific detail tabs (merged with global tabs from provider) */
  detailTabs?: DetailTabPlugin[];
  /** Panels rendered in the right sidebar of the detail page */
  rightSidebarPanels?: RightSidebarPanel[];
  /** Header plugins rendered between the title block and the detail tabs */
  headerPlugins?: HeaderPlugin[];
  /** Entity-specific list view modes (merged with global list views from provider) */
  listViews?: ListViewPlugin[];
}

/** Registration for a named cell renderer used in list view columns */
export interface ColumnRendererRegistration {
  component: ComponentType<{ value: unknown; row: Record<string, unknown>; entityType: string }>;
}
