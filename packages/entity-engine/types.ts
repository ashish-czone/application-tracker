import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { FieldType, SeedSectionInput, SetPicklistOptionInput } from '@packages/eav-attributes';

// ---------------------------------------------------------------------------
// Field metadata — presentation info that can't be derived from Drizzle schema
// ---------------------------------------------------------------------------

export interface FieldMeta {
  label: string;
  /** Which layout section this field belongs to (matched by section name) */
  section: string;
  /** Sort order within the section */
  sortOrder: number;
  /** Override the auto-detected field type */
  fieldType?: FieldType;
  /** Custom UI widget type (e.g. 'color-picker') */
  uiType?: string;
  /** Whether the field appears on the quick-create form */
  isQuickCreate?: boolean;
  /** System fields cannot be removed by admins */
  isSystem?: boolean;
  /** Field must have a unique value across all entities */
  isUnique?: boolean;
  /** Field is read-only in forms */
  isReadonly?: boolean;
  /** Max length for text-based fields */
  maxLength?: number;
  /** Default value */
  defaultValue?: string;
  /** Picklist options (for picklist/multi_select field types) */
  picklistOptions?: SetPicklistOptionInput[];
  /** Lookup target entity (for lookup field type) */
  lookupEntity?: string;
  /** Lookup label field */
  lookupLabelField?: string;
  /** Lookup search fields */
  lookupSearchFields?: string[];
  /** Tag group slug (for tags field type) */
  tagGroupSlug?: string;
  /** Category group slug (for category field type) */
  categoryGroupSlug?: string;
  /** Accepted MIME types (for file field type) */
  accept?: string[];
  /** Max file size in bytes (for file field type) */
  maxFileSize?: number;
}

// ---------------------------------------------------------------------------
// Media field configuration
// ---------------------------------------------------------------------------

export interface MediaFieldConfig {
  /** MIME types accepted */
  accept: string[];
  /** Display label */
  label: string;
  /** Max file size in bytes */
  maxFileSize?: number;
  /** Max number of files (default 1) */
  maxFiles?: number;
}

// ---------------------------------------------------------------------------
// Entity relationships
// ---------------------------------------------------------------------------

export interface EntityRelationship {
  /** Relationship name (used as key) */
  name: string;
  /** Relationship type */
  type: 'hasMany' | 'belongsTo' | 'manyToMany';
  /** Target entity type (must be registered in the registry) */
  targetEntity: string;
  /** Foreign key column on the target entity (for hasMany) */
  foreignKey?: string;
  /** Foreign key column on this entity (for belongsTo) */
  inverseForeignKey?: string;
  /** Junction entity type (for manyToMany) */
  junctionEntity?: string;
  /** Display label for the related list */
  label: string;
  /** Fields to show in the related list (field keys) */
  displayFields?: string[];
}

// ---------------------------------------------------------------------------
// UI hints — serialized to frontend via registry API
// ---------------------------------------------------------------------------

export interface EntityUIHints {
  /** Lucide icon name */
  icon: string;
  /** Field key(s) for display name on detail page header */
  nameField: string | string[];
  /** Field key for subtitle */
  subtitleField?: string;
  /** Sidebar nav group */
  navGroup?: string;
  /** Sidebar ordering within group */
  navOrder?: number;
  /** How the "Add" button works: 'modal' = quick-create dialog, 'page' = full create form page. Default: 'modal' */
  createMode?: 'modal' | 'page';
}

// ---------------------------------------------------------------------------
// EntityConfig — the single config that defines everything about an entity
// ---------------------------------------------------------------------------

export interface EntityConfig<TTable extends PgTable = PgTable> {
  // --- Identity ---

  /** Entity type key — used in field_definitions.entity_type, events, RBAC, etc. */
  entityType: string;
  /** Singular display name (e.g. 'Candidate') */
  singularName: string;
  /** Plural display name (e.g. 'Candidates') */
  pluralName: string;
  /** URL slug + API route prefix (e.g. 'candidates') */
  slug: string;

  // --- Database ---

  /** Drizzle table reference */
  table: TTable;
  /** Column keys excluded from EAV registration (audit columns, media columns, etc.) */
  systemColumns: string[];

  // --- Search ---

  /** Columns to ILIKE search across (standard DB columns only) */
  searchColumns: PgColumn[];

  // --- Sort ---

  /** Default sort field key */
  defaultSort: string;
  /** Sortable columns mapped by field key */
  sortableColumns: Record<string, PgColumn>;

  // --- Field metadata ---

  /** Presentation metadata per field (keyed by camelCase field key matching Drizzle property name) */
  fieldMeta: Record<string, FieldMeta>;
  /** Default layout sections with field assignments */
  sections: SeedSectionInput[];

  // --- Features (opt-in) ---

  features?: {
    /** Enable soft delete (default true) */
    softDelete?: boolean;
    /** Enable restore from soft delete (default true) */
    restore?: boolean;
    /** Enable taxonomy (tags) — specify the tag group slug */
    taxonomy?: { tagGroupSlug: string; label: string };
    /** Enable workflow state machine — specify workflow slug and status column */
    workflow?: { slug: string; statusColumn: PgColumn };
    /** Enable media/file fields — map of field name to config */
    media?: Record<string, MediaFieldConfig>;
  };

  // --- Lookup ---

  /** If set, this entity can be referenced by lookup fields on other entities */
  lookup?: {
    /** Column to use as the display label */
    labelField: string;
    /** Columns to search when typing in a lookup field */
    searchFields: string[];
  };

  // --- Relationships ---

  /** Related entities shown on detail page */
  relationships?: EntityRelationship[];

  // --- Notification recipients ---

  /** User-typed fields that can be notification recipients */
  recipientFields?: Record<string, { label: string }>;

  // --- RBAC ---

  /** Additional permissions beyond CRUD (CRUD is auto-generated) */
  extraPermissions?: { action: string; description: string }[];

  // --- Events ---

  /** Additional events beyond created/updated/deleted (those are auto-generated) */
  extraEvents?: { name: string; description: string }[];

  // --- Actions ---

  /** Configurable actions for list pages (row-level and bulk) */
  actions?: EntityActions;

  // --- UI ---

  /** Frontend rendering hints (serialized to registry API) */
  ui: EntityUIHints;

  // --- Lifecycle hooks ---

  hooks?: EntityHooks;
}

// ---------------------------------------------------------------------------
// Lifecycle hooks — domain-specific logic injected into the generic engine
// ---------------------------------------------------------------------------

export interface EntityHooks {
  /** Called before inserting a new entity. Can modify the payload. */
  beforeCreate?: (payload: Record<string, unknown>, actorId: string, tx?: any) => Promise<Record<string, unknown>>;
  /** Called after a new entity is inserted (after transaction commits). */
  afterCreate?: (entity: Record<string, unknown>, actorId: string) => Promise<void>;
  /** Called before updating an entity. Can modify the payload. */
  beforeUpdate?: (id: string, payload: Record<string, unknown>, actorId: string, tx?: any) => Promise<Record<string, unknown>>;
  /** Called after an entity is updated. */
  afterUpdate?: (entity: Record<string, unknown>, actorId: string) => Promise<void>;
  /** Called before soft-deleting an entity. Can throw to prevent deletion. */
  beforeDelete?: (id: string, actorId: string) => Promise<void>;
  /** Build additional WHERE conditions for list queries from the raw query params. */
  buildListFilters?: (query: Record<string, unknown>) => SQL[];
  /** Custom response transformation (merge DB row + EAV values). Overrides default merge. */
  toResponse?: (dbRow: Record<string, unknown>, eavValues: Record<string, unknown>) => Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Base list query — common pagination/search/sort params for all entities
// ---------------------------------------------------------------------------

export interface BaseListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  includeDeleted?: boolean;
  /** Additional filter params (entity-specific, passed to hooks.buildListFilters) */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Actions — configurable per-entity actions for list pages
// ---------------------------------------------------------------------------

export type ActionVariant = 'default' | 'destructive';

export interface EntityAction {
  /** Unique key identifying the action */
  key: string;
  /** Display label */
  label: string;
  /** Lucide icon name */
  icon?: string;
  /** CRUD permission required (maps to existing slug.{permission}) */
  permission: 'create' | 'read' | 'update' | 'delete';
  /** Visual variant */
  variant?: ActionVariant;
}

export interface EntityActions {
  /** Actions shown in the per-row "..." dropdown menu */
  row: EntityAction[];
  /** Actions shown in the bulk toolbar when rows are selected */
  bulk: EntityAction[];
}

// ---------------------------------------------------------------------------
// List layout — config returned by GET /{slug}/layout/list
// ---------------------------------------------------------------------------

export interface ListLayoutColumn {
  /** Field key */
  fieldKey: string;
  /** Display label */
  label: string;
  /** Field type (for formatting) */
  fieldType: string;
  /** Whether the column is sortable */
  sortable: boolean;
  /** Lookup entity (for lookup columns) */
  lookupEntity?: string;
}

export interface ListLayoutResponse {
  /** Columns to display in the list table */
  columns: ListLayoutColumn[];
  /** Available actions */
  actions: EntityActions;
  /** Filterable field keys */
  filters: string[];
  /** Default sort field */
  defaultSort: string;
  /** Default sort direction */
  defaultOrder: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Serializable registry entry — what the frontend receives via GET /entity-engine/registry
// ---------------------------------------------------------------------------

export interface EntityRegistryEntry {
  entityType: string;
  singularName: string;
  pluralName: string;
  slug: string;
  ui: EntityUIHints;
  features: {
    softDelete: boolean;
    restore: boolean;
    hasTaxonomy: boolean;
    hasWorkflow: boolean;
    hasMedia: boolean;
  };
  relationships: Omit<EntityRelationship, 'inverseForeignKey' | 'junctionEntity'>[];
}
