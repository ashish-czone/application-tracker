import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { FieldType, SeedSectionInput, SetPicklistOptionInput } from '@packages/eav-attributes';
import type { Condition } from '@packages/notifications';
import type { WorkflowGuardFn } from '@packages/workflows';

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
  /** Workflow config (for workflow field type) */
  workflow?: WorkflowFieldConfig;
}

// ---------------------------------------------------------------------------
// Workflow field configuration
// ---------------------------------------------------------------------------

export interface WorkflowDiscriminatorOption {
  value: string;
  label: string;
}

export interface WorkflowDiscriminator {
  /** Unique key identifying this discriminator (e.g., 'client-country') */
  key: string;
  /** Human-readable label for admin UI (e.g., 'Client Country') */
  label: string;
  /** Allowed values the admin can choose from when creating pipelines */
  options: WorkflowDiscriminatorOption[];
  /** Resolves the discriminator value for a given entity at runtime */
  resolve: (
    entityData: Record<string, unknown>,
    services: { findEntity: (entityType: string, id: string) => Promise<Record<string, unknown>> },
  ) => Promise<string>;
}

export interface WorkflowFieldConfig {
  /** Unique slug for the workflow definition (e.g., 'application-status') */
  slug: string;
  /** The initial state for new entities */
  initialState: string;
  /** All possible states */
  states: WorkflowStateDef[];
  /** Allowed transitions between states */
  transitions: WorkflowTransitionDef[];
  /** Optional discriminator for multi-pipeline support */
  discriminator?: WorkflowDiscriminator;
}

export interface WorkflowStateDef {
  /** State identifier (stored in DB) */
  name: string;
  /** Display label */
  label: string;
  /** Color for UI badges */
  color?: string;
}

export interface WorkflowTransitionDef {
  /** Source state name */
  from: string;
  /** Possible target states — plain string (no conditions) or object (with conditions/permissions/guards) */
  to: (string | WorkflowTargetDef)[];
}

export interface WorkflowTargetDef {
  /** Target state name */
  state: string;
  /** Additional permissions required for this transition */
  requiredPermissions?: string[];
  /** Named guard functions to execute (registered in hooks.workflowGuards) */
  guardNames?: string[];
  /** Declarative conditions evaluated against entity field values */
  conditions?: Condition[];
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
  /** How the "Add" button works: 'modal' = quick-create dialog, 'page' = full create form page, 'wizard' = multi-step (one section per step). Default: 'modal' */
  createMode?: 'modal' | 'page' | 'wizard';
  /** Picklist field keys that can be used as board/kanban grouping. Enables board view toggle on list page. */
  boardFields?: string[];
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
  /** Field keys to display by default in the list view (in order). Fields not listed are hidden but available via Columns toggle. */
  listFields?: string[];

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
  /** Custom workflow guard functions, keyed by name. Referenced by guardNames in transition config. */
  workflowGuards?: Record<string, WorkflowGuardFn>;
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
  /** Structured filters as JSON string: [{"field":"status","operator":"eq","value":"active"}] */
  filters?: string;
  /** Additional filter params (entity-specific, passed to hooks.buildListFilters) */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Actions — configurable per-entity actions for list pages
// ---------------------------------------------------------------------------

export type ActionVariant = 'default' | 'destructive';

export interface PickerExistingCheck {
  /** URL to fetch existing associations from (e.g., '/api/v1/applications') */
  listUrl: string;
  /** Query param to filter by the source record (e.g., 'candidateId') */
  filterField: string;
  /** Field in results whose value matches picker row IDs (e.g., 'jobOpeningId') */
  matchField: string;
  /** Badge label shown on matching rows (e.g., 'Already applied') */
  label: string;
  /** Whether to prevent selection of matching rows. Defaults to true. */
  disableSelection?: boolean;
}

export interface PickerConfig {
  /** Entity type to show in the picker */
  entityType: string;
  /** Single or multiple selection */
  selectionMode: 'single' | 'multiple';
  /** URL to POST selected IDs to */
  submitUrl: string;
  /** Maps field names to values. :id = current record, :selectedId = picked record */
  fieldMapping: Record<string, string>;
  /** Optional: check for existing associations and label/disable matching rows */
  existingCheck?: PickerExistingCheck;
}

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
  /** Picker config — opens a slide-over entity picker when set */
  picker?: PickerConfig;
}

export interface EntityActions {
  /** Actions shown in the per-row "..." dropdown menu */
  row: EntityAction[];
  /** Actions shown in the bulk toolbar when rows are selected */
  bulk: EntityAction[];
  /** Actions shown on the entity detail page */
  detail: EntityAction[];
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
  /** Whether the column is visible by default */
  visible: boolean;
  /** Display order (lower = first) */
  order: number;
  /** If this is a relationship count column, the relationship metadata */
  relationship?: {
    targetEntity: string;
    foreignKey: string;
  };
  /** Picklist options (for picklist/multi_select cell formatting) */
  picklistOptions?: { label: string; value: string }[];
  /** Valid filter operators for this column's field type */
  operators?: string[];
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
