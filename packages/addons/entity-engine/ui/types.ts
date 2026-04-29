import type { ComponentType } from 'react';
import type { PaginatedResponse } from '@packages/common';

/** Matches EntityRegistryEntry from the backend */
export interface EntityRegistryEntry {
  entityType: string;
  singularName: string;
  pluralName: string;
  slug: string;
  /**
   * Field key (or composite key array) used as the canonical display name
   * for records. Independent of presentation — owned by the api so it can
   * include the column in LIST select maps.
   */
  nameField: string | string[];
  /** Field key used as record subtitle on detail headers and list cards. */
  subtitleField?: string;
  /**
   * Presentation hints — populated client-side by hydration from the
   * registered `EntityUIConfig.presentation`. Not present on the wire.
   */
  ui?: {
    icon?: string;
    navGroup?: string;
    navOrder?: number;
    groupRenderMode?: 'tabs';
    createMode?: 'modal' | 'page' | 'wizard';
    boardFields?: string[];
    afterCreateRoute?: string;
  };
  /**
   * Engine-derived flags merged with feature-package-derived keys and the
   * entity's opaque addon `features` bag. Engine keys are typed below;
   * feature-package keys (workflows, ...) and addon keys come from
   * registered derivers / `EntityConfig.features` verbatim and are read
   * by the package that owns them via its own reader.
   */
  features: {
    softDelete: boolean;
    restore: boolean;
    /** Entity exposes DB-backed definitions that admins can customize via the admin UI. */
    adminConfigurable: boolean;
    hasTaxonomy: boolean;
    hasMedia: boolean;
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

/**
 * Entity-level presentation hints. These are pure UI concerns (icon, nav,
 * createMode, etc.) that previously lived on the api-side `EntityConfig.ui`
 * block. They belong here in the UI package; the api package is moving to
 * have zero awareness of UI shape.
 */
export interface EntityUIPresentation {
  /** Singular display name (e.g. 'Candidate'). When set, FE prefers this over the api-shipped value. */
  singularName?: string;
  /** Plural display name (e.g. 'Candidates'). When set, FE prefers this over the api-shipped value. */
  pluralName?: string;
  /** Field key used as the subtitle on detail headers and list/board cards. When set, FE prefers this over the api-shipped value. */
  subtitleField?: string;
  /** Lucide icon name */
  icon?: string;
  /** Sidebar nav group. When multiple entities share a navGroup and set `groupRenderMode: 'tabs'`, the platform collapses them into a single nav link and renders a tabbed page. */
  navGroup?: string;
  /** Sidebar ordering within group. When grouped via `groupRenderMode: 'tabs'`, also drives tab order. */
  navOrder?: number;
  /** How entities in the same `navGroup` are presented. `'tabs'` collapses all grouped entities into one nav link routed to a tabbed group page. */
  groupRenderMode?: 'tabs';
  /** How the "Add" button works. Default: 'modal' */
  createMode?: 'modal' | 'page' | 'wizard';
  /** Picklist field keys that can be used as board/kanban grouping. */
  boardFields?: string[];
  /** Route template used by the list page after a successful quick-create. `:id` is interpolated with the created entity id. */
  afterCreateRoute?: string;
}

/**
 * Per-field UI overrides. Keyed by field key (camelCase, matches Drizzle
 * property name). Previously lived on `FieldMeta` in the api package.
 *
 * For each field below: when set, the FE-side value wins over the api's
 * `FieldMeta` / `FieldDefinition` shipped value. Strip B-4 will drop the
 * api-side counterparts entirely for code-defined entities — admin-
 * configurable entities continue to source these from DB-backed
 * `field_definitions` rows that admins edit.
 */
export interface FieldUI {
  /** Display label for the field (form label, list column header). */
  label?: string;
  /** Form-section name this field belongs to (matched by section name in `formLayout.sections`). */
  section?: string;
  /** Display order within the section, and within the quick-create form. */
  sortOrder?: number;
  /** Whether the field appears on the quick-create form. */
  isQuickCreate?: boolean;
  /** Hide from the list columns picker but still fetch its value (so a cellRenderer on another field can read it). */
  listColumnHidden?: boolean;
  /** Custom UI widget type (e.g. 'color-picker') */
  uiType?: string;
  /** Named cell renderer for the list view (looked up in EntityEngineProvider columnRenderers registry) */
  cellRenderer?: string;
}

/**
 * Form-section definition. Mirrors the shape of the api's `SeedSectionInput`
 * but lives in the UI package so the FE owns form layout end-to-end.
 */
export interface FormLayoutSection {
  /** Section display name. */
  name: string;
  /** Field keys in order. Use [key, columnIndex] tuples for explicit column assignment. */
  fields: (string | [string, number])[];
  /** Number of columns in the section grid. Default 1. */
  columns?: number;
  /** Whether the section is collapsible. */
  isCollapsible?: boolean;
  /** Render as a tabular section (rows of related records). */
  isTabular?: boolean;
  /** Cap on rows for tabular sections. */
  tabularMaxRows?: number;
}

/**
 * Per-entity form layout config. When set, the FE form layout hook prefers
 * this over the api's `getLayout()` response. Admin-configurable entities
 * continue to source layout from DB.
 */
export interface FormLayoutConfig {
  sections: FormLayoutSection[];
  /** Field keys that appear on the quick-create form. */
  quickCreateFields?: string[];
}

/**
 * Per-entity list-column config. Determines which fields are visible by
 * default in the list view, and their display order. When set, FE prefers
 * these visible/order flags over the api's `getListLayout()` defaults.
 */
export interface ListColumnConfig {
  fieldKey: string;
  /** Whether the column is visible by default. */
  visible?: boolean;
  /** Display order (lower = first). */
  order?: number;
}

/**
 * Per-action UI overrides. Keyed by action key. Previously lived on
 * `EntityAction` in the api package.
 */
export interface ActionUI {
  /** Display label */
  label?: string;
  /** Lucide icon name */
  icon?: string;
  /** Visual variant */
  variant?: 'default' | 'destructive';
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
  /** Entity-level presentation hints (icon, nav group, createMode, ...). */
  presentation?: EntityUIPresentation;
  /** Per-field UI overrides (label, section, sortOrder, isQuickCreate, listColumnHidden, uiType, cellRenderer). Keyed by field key. */
  fieldUI?: Record<string, FieldUI>;
  /** Per-action UI overrides (label, icon, variant). Keyed by action key. */
  actionUI?: Record<string, ActionUI>;
  /** Form layout (sections + quick-create fields). FE-owned source of truth for code-defined entities. */
  formLayout?: FormLayoutConfig;
  /** List view default columns (visibility + order). FE-owned source of truth for code-defined entities. */
  listColumns?: ListColumnConfig[];
}

/** Registration for a named cell renderer used in list view columns */
export interface ColumnRendererRegistration {
  component: ComponentType<{ value: unknown; row: Record<string, unknown>; entityType: string }>;
}
