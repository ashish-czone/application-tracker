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
    createMode?: 'modal' | 'page' | 'wizard';
    boardFields?: string[];
  };
  features: {
    softDelete: boolean;
    restore: boolean;
    /** Entity exposes DB-backed definitions that admins can customize via the admin UI. */
    adminConfigurable: boolean;
    hasTaxonomy: boolean;
    hasWorkflow: boolean;
    hasMedia: boolean;
    hasNotes: boolean;
    hasAttachments: boolean;
    hasEvaluations: boolean;
    hasTags?: { groupSlug: string };
    workflowDiscriminator?: {
      key: string;
      label: string;
      options: { value: string; label: string }[];
      fieldName: string;
    } | null;
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
  /** If set, tab only shows when entity.features[featureFlag] is truthy */
  featureFlag?: string;
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
  /** If set, view only shows when entity.features[featureFlag] is truthy */
  featureFlag?: string;
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
  /** If set, panel only shows when entity.features[featureFlag] is truthy */
  featureFlag?: string;
  /** Whether the panel starts collapsed */
  defaultCollapsed?: boolean;
}

/** Frontend-side entity UI config (supplements the backend registry) */
export interface EntityUIConfig {
  entityType: string;
  detailPlugins?: EntityDetailPlugin[];
  /** Entity-specific detail tabs (merged with global tabs from provider) */
  detailTabs?: DetailTabPlugin[];
  /** Panels rendered in the right sidebar of the detail page */
  rightSidebarPanels?: RightSidebarPanel[];
  /** Entity-specific list view modes (merged with global list views from provider) */
  listViews?: ListViewPlugin[];
}

/** Registration for a named cell renderer used in list view columns */
export interface ColumnRendererRegistration {
  component: ComponentType<{ value: unknown; row: Record<string, unknown>; entityType: string }>;
}
