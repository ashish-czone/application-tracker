import type { PgTable } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Condition } from '@packages/common';

// ---------------------------------------------------------------------------
// Field type system — defines what kinds of fields entities can have
// ---------------------------------------------------------------------------

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'currency'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'url'
  | 'textarea'
  | 'picklist'
  | 'multi_select'
  | 'lookup'
  | 'user'
  | 'auto_number'
  | 'tags'
  | 'file'
  | 'category'
  | 'multi_user'
  | 'multi_lookup'
  | 'rich_text'
  | 'workflow'
  | 'data_source';

/** Field types that bypass the standard EAV pipeline (use join tables or special handling).
 *  Note: 'category' is NOT included — it stores a UUID in the standard/EAV column like a lookup. */
export const RELATIONAL_FIELD_TYPES = new Set<FieldType>(['tags', 'multi_user', 'multi_lookup']);

/** Maps field types to EAV value columns */
export type EavValueColumn = 'valueText' | 'valueNumber' | 'valueDate' | 'valueDatetime' | 'valueBoolean';

/** Which EAV column each field type writes to (relational types not included — they bypass EAV) */
export const FIELD_TYPE_TO_VALUE_COLUMN: Partial<Record<FieldType, EavValueColumn>> = {
  text: 'valueText',
  email: 'valueText',
  phone: 'valueText',
  url: 'valueText',
  textarea: 'valueText',
  rich_text: 'valueText',  // stored as HTML string
  picklist: 'valueText',
  multi_select: 'valueText', // stored as JSON array string
  lookup: 'valueText',       // stores the referenced entity ID
  user: 'valueText',         // stores the user ID
  auto_number: 'valueText',
  file: 'valueText',          // stored as JSON string (MediaFile object)
  workflow: 'valueText',     // stores current state name as string
  number: 'valueNumber',
  currency: 'valueNumber',
  decimal: 'valueNumber',
  date: 'valueDate',
  datetime: 'valueDatetime',
  boolean: 'valueBoolean',
};

// ---------------------------------------------------------------------------
// Field Type Registry — centralized metadata for all field types
// ---------------------------------------------------------------------------

export interface FieldTypeRegistryEntry {
  type: FieldType;
  label: string;
  /** Whether admins can create custom fields of this type */
  creatable: boolean;
  /** Display order in the field type palette */
  sortOrder: number;
  /** Lucide icon name */
  icon: string;
  /** CSS color classes for badges */
  color: string;
}

export const FIELD_TYPE_REGISTRY: FieldTypeRegistryEntry[] = [
  { type: 'text',         label: 'Text',         creatable: true,  sortOrder: 0,  icon: 'Type',         color: 'bg-blue-100 text-blue-800' },
  { type: 'number',       label: 'Number',       creatable: true,  sortOrder: 1,  icon: 'Hash',         color: 'bg-emerald-100 text-emerald-800' },
  { type: 'email',        label: 'Email',        creatable: true,  sortOrder: 2,  icon: 'Mail',         color: 'bg-indigo-100 text-indigo-800' },
  { type: 'phone',        label: 'Phone',        creatable: true,  sortOrder: 3,  icon: 'Phone',        color: 'bg-violet-100 text-violet-800' },
  { type: 'currency',     label: 'Currency',     creatable: true,  sortOrder: 4,  icon: 'DollarSign',   color: 'bg-green-100 text-green-800' },
  { type: 'date',         label: 'Date',         creatable: true,  sortOrder: 5,  icon: 'Calendar',     color: 'bg-amber-100 text-amber-800' },
  { type: 'picklist',     label: 'Picklist',     creatable: true,  sortOrder: 6,  icon: 'List',         color: 'bg-orange-100 text-orange-800' },
  { type: 'multi_select', label: 'Multi-select', creatable: true,  sortOrder: 7,  icon: 'ListChecks',   color: 'bg-orange-100 text-orange-800' },
  { type: 'boolean',      label: 'Checkbox',     creatable: true,  sortOrder: 8,  icon: 'CheckSquare',  color: 'bg-slate-100 text-slate-800' },
  { type: 'url',          label: 'URL',          creatable: true,  sortOrder: 9,  icon: 'Link',         color: 'bg-cyan-100 text-cyan-800' },
  { type: 'textarea',     label: 'Multi-line',   creatable: true,  sortOrder: 10, icon: 'AlignLeft',    color: 'bg-blue-100 text-blue-800' },
  { type: 'rich_text',    label: 'Rich Text',    creatable: true,  sortOrder: 11, icon: 'FileText',     color: 'bg-blue-100 text-blue-800' },
  { type: 'decimal',      label: 'Decimal',      creatable: true,  sortOrder: 12, icon: 'Hash',         color: 'bg-emerald-100 text-emerald-800' },
  { type: 'datetime',     label: 'DateTime',     creatable: true,  sortOrder: 13, icon: 'Clock',        color: 'bg-amber-100 text-amber-800' },
  { type: 'lookup',       label: 'Lookup',       creatable: true,  sortOrder: 14, icon: 'Search',       color: 'bg-purple-100 text-purple-800' },
  { type: 'multi_lookup', label: 'Multi-lookup', creatable: true,  sortOrder: 15, icon: 'Search',       color: 'bg-purple-100 text-purple-800' },
  { type: 'user',         label: 'User',         creatable: true,  sortOrder: 16, icon: 'User',         color: 'bg-pink-100 text-pink-800' },
  { type: 'multi_user',   label: 'Multi-user',   creatable: true,  sortOrder: 17, icon: 'Users',        color: 'bg-pink-100 text-pink-800' },
  { type: 'tags',         label: 'Tags',         creatable: true,  sortOrder: 18, icon: 'Tag',          color: 'bg-teal-100 text-teal-800' },
  { type: 'category',     label: 'Category',     creatable: true,  sortOrder: 19, icon: 'FolderTree',   color: 'bg-yellow-100 text-yellow-800' },
  { type: 'file',         label: 'File',         creatable: true,  sortOrder: 20, icon: 'Paperclip',    color: 'bg-gray-100 text-gray-800' },
  { type: 'auto_number',  label: 'Auto Number',  creatable: false, sortOrder: 21, icon: 'Hash',         color: 'bg-gray-100 text-gray-800' },
  { type: 'workflow',     label: 'Workflow',      creatable: false, sortOrder: 22, icon: 'GitBranch',    color: 'bg-blue-100 text-blue-800' },
  { type: 'data_source',  label: 'Data Source',   creatable: false, sortOrder: 23, icon: 'Database',     color: 'bg-blue-100 text-blue-800' },
];

// ---------------------------------------------------------------------------
// Field definition — runtime metadata for a registered field
// ---------------------------------------------------------------------------

export interface FieldDefinition {
  id: string;
  entityType: string;
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  uiType: string | null;
  isRequired: boolean;
  isSystem: boolean;
  isCustom: boolean;
  isUnique: boolean;
  isQuickCreate: boolean;
  isReadonly: boolean;
  maxLength: number | null;
  defaultValue: string | null;
  columnName: string | null;
  lookupEntity: string | null;
  lookupLabelField: string | null;
  lookupSearchFields: string[] | null;
  // Relational field config
  tagGroupSlug: string | null;
  categoryGroupSlug: string | null;
  fileAccept: string[] | null;
  fileMaxSize: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PicklistOption {
  id: string;
  fieldId: string;
  label: string;
  value: string;
  isDefault: boolean;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Layout types — UI layout structure for entity forms
// ---------------------------------------------------------------------------

export interface LayoutSection {
  id: string;
  entityType: string;
  layoutName: string;
  name: string;
  columns: number;
  sortOrder: number;
  isCollapsible: boolean;
  isTabular: boolean;
  tabularMaxRows: number | null;
  createdAt: Date;
}

export interface LayoutField {
  id: string;
  sectionId: string;
  fieldId: string;
  sortOrder: number;
  columnIndex: number;
}

// --- Full layout response (like Zoho's Create.do?format=json) ---

export interface FullLayoutField extends FieldDefinition {
  picklistOptions: PicklistOption[];
  columnIndex: number;
  /**
   * When set, this field belongs to a hasOne relationship's nested payload
   * (keyed by `nestedPath` in the submitted DTO). The form renderer uses
   * this to reshape flat RHF values into `{ ..., [nestedPath]: { ... } }`
   * before POSTing to the parent endpoint.
   */
  nestedPath?: string | null;
}

export interface FullLayoutSection {
  id: string;
  name: string;
  columns: number;
  sortOrder: number;
  isCollapsible: boolean;
  isTabular: boolean;
  tabularMaxRows: number | null;
  fields: FullLayoutField[];
}

/**
 * Collection-style relationship (hasMany / manyToMany) rendered as a
 * separate section in the parent's create/edit form. The UI drives a
 * multi-select picker against the target entity's lookup config.
 */
export interface FullLayoutRelationSection {
  /** Relationship name — the DTO key (e.g. 'roles'). */
  name: string;
  label: string;
  type: 'hasMany' | 'manyToMany';
  targetEntity: string;
  displayFields?: string[];
  sortOrder: number;
}

export interface FullLayout {
  entityType: string;
  layoutName: string;
  sections: FullLayoutSection[];
  /** Sections for hasMany / manyToMany relationships. hasOne nested fields
   *  are placed in the main `sections[]` instead so they submit atomically
   *  with the parent. */
  relationSections: FullLayoutRelationSection[];
  quickCreateFields: FullLayoutField[];
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'contains';

export interface FieldFilter {
  fieldKey: string;
  operator: FilterOperator;
  value: unknown;
}

// ---------------------------------------------------------------------------
// Lookup resolution
// ---------------------------------------------------------------------------

export { LOOKUP_RESOLVER_TOKEN } from '@packages/entity-engine-contract';
export type { LookupConfig, LookupResolver } from '@packages/entity-engine-contract';

export interface LookupResult {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Registration input types — used for seeding field definitions
// ---------------------------------------------------------------------------

export interface RegisterFieldInput {
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  uiType?: string;
  isRequired?: boolean;
  isSystem?: boolean;
  isUnique?: boolean;
  isQuickCreate?: boolean;
  isReadonly?: boolean;
  maxLength?: number;
  defaultValue?: string;
  columnName?: string;
  lookupEntity?: string;
  lookupLabelField?: string;
  lookupSearchFields?: string[];
  // Relational field config
  tagGroupSlug?: string;
  categoryGroupSlug?: string;
  fileAccept?: string[];
  fileMaxSize?: number;
  sortOrder?: number;
}

export interface SeedSectionInput {
  name: string;
  columns?: number;
  isCollapsible?: boolean;
  isTabular?: boolean;
  tabularMaxRows?: number;
  /** Field keys in order. Use [key, columnIndex] tuples for explicit column assignment. */
  fields: (string | [string, number])[];
}

export interface SetPicklistOptionInput {
  label: string;
  value: string;
  isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// Field metadata — presentation info that can't be derived from Drizzle schema
// ---------------------------------------------------------------------------

export interface FieldMeta {
  label: string;
  /** Which layout section this field belongs to (matched by section name). Omit for computed/virtual fields. */
  section?: string;
  /** Sort order within the section. Omit for computed/virtual fields. */
  sortOrder?: number;
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
  /** Named cell renderer for the list view (looked up in EntityEngineProvider registry) */
  cellRenderer?: string;
  /** Completely exclude this field from the list view (won't be fetched, won't appear in columns picker) */
  excludeFromList?: boolean;
  /** Fetched in list queries for data purposes, but not emitted as a column — hidden from the columns picker. */
  listColumnHidden?: boolean;
  /**
   * For JSONB custom fields: flag the field as frequently filtered/sorted so the
   * expression-index generator emits a btree index on custom_fields ->> 'key'.
   * Has no effect for schema-column fields or EAV entities.
   */
  indexed?: boolean;
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
    services: {
      findEntity: (entityType: string, id: string) => Promise<Record<string, unknown>>;
      findCategory: (categoryId: string) => Promise<{ id: string; name: string; slug: string } | null>;
    },
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
  /**
   * Canonical state wired into code (e.g. terminal states the engine checks
   * by name). Admin UIs must block rename/delete on system states; non-system
   * states can be added/renamed/removed freely.
   */
  isSystem?: boolean;
}

export interface WorkflowTransitionDef {
  /** Source state name */
  from: string;
  /** Possible target states — plain string (no conditions) or object (with conditions/permissions) */
  to: (string | WorkflowTargetDef)[];
}

export interface WorkflowTargetDef {
  /** Target state name */
  state: string;
  /** Additional permissions required for this transition */
  requiredPermissions?: string[];
  /** Declarative conditions evaluated against entity field values */
  conditions?: Condition[];
  /** Require the actor to supply a reason (validated against `reasonOptions` if set). */
  reasonRequired?: boolean;
  /** Require the actor to supply a free-text comment. */
  commentRequired?: boolean;
  /** Constrained list of allowed values for `reason` — when set, reasons outside this list are rejected. */
  reasonOptions?: string[];
}

// ---------------------------------------------------------------------------
// Entity relationships
// ---------------------------------------------------------------------------

export interface EntityRelationship {
  /** Relationship name (used as key) */
  name: string;
  /** Relationship type */
  type: 'hasMany' | 'belongsTo' | 'hasOne' | 'manyToMany';
  /** Target entity type (must be registered in the registry) */
  targetEntity: string;
  /**
   * The FK column that links the two entities. Direction is implied by type:
   * - `belongsTo`: column lives on THIS entity, pointing to target
   * - `hasOne` / `hasMany`: column lives on the TARGET entity, pointing back
   * - `manyToMany`: not used — use `junctionEntity` instead
   */
  foreignKey?: string;
  /** Junction entity type (for manyToMany only) */
  junctionEntity?: string;
  /** Display label for the related list */
  label: string;
  /** Fields to show in the related list (field keys) */
  displayFields?: string[];
  /**
   * For `hasOne` relationships only: the fields that render inline in the
   * parent's main form (e.g. `{ fieldKey: 'password', fieldType: 'text',
   * uiType: 'password' }` for a user's credentials). The DTO keeps them
   * nested under this relationship's name, and the layout builder emits
   * them with a `nestedPath` hint so the form knows how to reshape values
   * before POSTing to the parent endpoint.
   *
   * Layout-only hint: the engine does not read this on the write path —
   * the owning module's hand-written service is responsible for validating
   * and storing these fields against its own table.
   */
  nestedFields?: NestedRelationshipField[];
}

/**
 * Minimal field spec carried on a `hasOne` relationship. Mirrors the shape
 * of `RegisterFieldInput` but drops columnName (nested fields don't live on
 * the parent table) and DB-level concerns. Enough for the layout builder
 * and form renderer to do their jobs.
 */
export interface NestedRelationshipField {
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  uiType?: string;
  isRequired?: boolean;
  maxLength?: number;
  defaultValue?: string;
  picklistOptions?: SetPicklistOptionInput[];
  lookupEntity?: string;
  lookupLabelField?: string;
  lookupSearchFields?: string[];
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Data access scopes — control which records a user can see
// ---------------------------------------------------------------------------

/**
 * Inline, entity-specific scope resolver. Use this for scope kinds whose
 * SQL is bound to a specific table and can't be expressed through the
 * generic anchor map (e.g. "applications for job openings I manage" has
 * to join through `jobOpenings`).
 *
 * Reusable scope kinds (`own`, `assigned`, `unit`, `descendants`, or any
 * domain-level primitive) should be registered into the global
 * `ScopeResolverRegistry` (@packages/rbac) by their owning module instead —
 * they get picked up automatically for every entity that declares the
 * matching anchors.
 */
export interface EntityScopeResolver {
  /** Unique key referenced by RBAC permission scopes (e.g. 'hiring-manager') */
  key: string;
  /** Human-readable label shown in RBAC admin UI */
  label: string;
  /** Returns a SQL WHERE condition that restricts visible records for this user */
  resolve(userId: string): Promise<SQL>;
}

/**
 * Data access configuration for an entity.
 *
 * `anchors` maps semantic column roles (`creator`, `assignee`, `team`, or
 * any custom role a resolver declares) to the actual column names on this
 * entity's table. Registered scope resolvers (@packages/rbac) consume these
 * anchors at query time. Omit a role an entity doesn't support — resolvers
 * that need it will simply return no predicate for this entity.
 *
 * `scopes` holds entity-specific inline resolvers for scope kinds that
 * can't be expressed through anchors (table-specific joins, etc.).
 */
export interface DataAccessConfig {
  /**
   * Semantic column roles for this entity. Keys are open-ended and match
   * the anchor roles that registered resolvers look up. Common keys:
   *   - creator   — user who created the row (anchor for `own`)
   *   - assignee  — user the row is currently assigned to (anchor for `assigned`)
   *   - team      — org unit the row belongs to (anchor for `unit`/`descendants`)
   */
  anchors?: Record<string, string>;

  /**
   * Entity-specific inline scope resolvers. Used when a role grant references
   * a scope type that isn't registered globally and whose SQL is specific
   * to this entity's table.
   */
  scopes?: EntityScopeResolver[];
}

// `AccessScopeSpec` and `DataAccessContext` live in `@packages/rbac`. Import
// them from there in service method signatures.


// ---------------------------------------------------------------------------
// Custom-fields storage mode
// ---------------------------------------------------------------------------

/**
 * Storage backend for an entity's admin-defined custom fields.
 * - `true` — JSONB column on the entity row (default, fastest, one query).
 * - `'eav'` — legacy shared EAV table via eav-attributes addon.
 * - `false` / omitted — no custom fields.
 */
export type CustomFieldsMode = boolean | 'eav';

// ---------------------------------------------------------------------------
// EntityConfig — the single config that defines everything about an entity
// ---------------------------------------------------------------------------

export interface EntityConfig<TTable extends PgTable = PgTable> {
  // --- Identity ---

  /** Entity type key — used in field_definitions.entity_type, events, RBAC, etc. */
  entityType: string;
  /**
   * Singular display name (e.g. 'Candidate').
   *
   * Optional. If unset, the engine derives a humanized form from the slug
   * (e.g. 'job-openings' → 'Job opening'). Override only when the FE-side
   * `EntityUIConfig.presentation.singularName` is not registered AND the
   * humanized slug is not acceptable. FE registry is the source of truth
   * for code-defined entities; this field is only the fallback the api
   * uses to populate `EntityRegistryEntry.singularName` on the wire.
   */
  singularName?: string;
  /**
   * Plural display name (e.g. 'Candidates').
   *
   * Optional. If unset, the engine derives a humanized form from the slug
   * (e.g. 'job-openings' → 'Job openings'). FE registry is the source of
   * truth — see `singularName` above.
   */
  pluralName?: string;
  /** URL slug + API route prefix (e.g. 'candidates') */
  slug: string;

  // --- Database ---

  /** Drizzle table reference */
  table: TTable;
  /** Column keys excluded from EAV registration (audit columns, media columns, etc.) */
  systemColumns: string[];

  // --- Search ---

  /** Field keys to ILIKE search across (must match column property names on the table). */
  searchFields: string[];

  // --- Sort ---

  /** Default sort field key */
  defaultSort: string;
  /** Field keys that may be used as sort targets (must match column property names on the table). */
  sortableFields: string[];

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

  /**
   * Additional permissions beyond CRUD (CRUD is auto-generated).
   *
   * `supportedScopes` narrows which scope types a role may attach to this
   * permission. Omit to inherit the entity's full derived set (CRUD default);
   * pass an explicit list for verbs where only a subset makes sense (e.g.
   * `pickup` — meaningful on `unit` / `unassigned_in_unit` but not `own`).
   */
  extraPermissions?: { action: string; description: string; supportedScopes?: string[] }[];

  // --- Events ---

  /** Additional events beyond created/updated/deleted (those are auto-generated) */
  extraEvents?: { name: string; description: string }[];

  // --- Actions ---

  /** Configurable actions for list pages (row-level and bulk) */
  actions?: EntityActions;

  // --- Custom fields ---

  /** Enable dynamic custom fields for this entity. Default: none.
   *  - `true` — **JSONB mode** (default storage). The entity table must spread
   *    `...customFieldsColumn()` so a `custom_fields jsonb` column exists. All
   *    admin-defined field values are stored inline on the row. One query loads
   *    row + all custom values.
   *  - `'eav'` — **Legacy EAV mode** (opt-in escape hatch). Values stored in the
   *    shared `entity_field_values` table via the eav-attributes addon. Use only
   *    for catalog-style entities with wildly sparse attributes.
   *  - `false` / omitted — no custom fields. All non-relational fields must map
   *    to DB columns. */
  customFields?: CustomFieldsMode;

  /** Allow admins to customize this entity at runtime (reorder layout, toggle field
   *  visibility, add/configure tags, categories, workflows). Default: false.
   *  When true: code-defined fields/layout are seeded to DB as `isSystem: true` rows
   *  and the DB becomes the source of truth. Admin screens show this entity. DB
   *  queries fire on layout/field-definition reads (cached).
   *  When false: the in-memory registry is the source of truth, no seeding happens,
   *  no DB queries for fields/layout, and the entity is hidden from admin screens.
   *  Independent of `customFields` — either flag can be enabled on its own. */
  adminConfigurable?: boolean;

  /** Mark this entity as hierarchical. Requires the table to expose `parentId`,
   *  `path`, and `depth` columns. Registers `path` and `depth` as system columns
   *  and auto-seeds `parentId` as a self-lookup field. Tree operations are not
   *  provided by the engine — call the hierarchy library directly from the
   *  owning module's service layer. Default: false. */
  hierarchy?: boolean;

  /** Mark this entity as orderable. Requires the table to expose a `sortOrder`
   *  integer column. Registers `sortOrder` as a system column and defaults the
   *  list sort to `sortOrder ASC, id ASC`. Sort-order writes are not provided
   *  by the engine — call the orderable library directly from the owning
   *  module's service layer. Default: false. */
  orderable?: boolean;

  // --- Addon features ---

  /**
   * Opaque bag of per-entity addon configuration. The engine forwards this
   * verbatim to `EntityRegistryEntry.features` and never inspects the keys.
   * Each addon owns one or more keys and ships a typed helper that returns
   * its fragment (e.g. `notesFeature()`, `attachmentsFeature({ ... })`).
   *
   * Engine-derived flags (`softDelete`, `hasMedia`, ...) and feature-package
   * keys registered via `FeatureDeriverRegistry` (e.g. `workflow`) are merged
   * into the same bag downstream — addon keys must not collide with those.
   */
  features?: Record<string, unknown>;

  // --- Computed columns ---

  /** SQL subquery expressions added to SELECT in list and detail queries.
   *  Each entry becomes an extra column in the response (e.g., averageRating, evaluationsCount).
   *  Computed columns can also be used as sort keys. */
  computedColumns?: { name: string; expression: SQL; sourceFields?: string[] }[];

  // --- Display ---

  /**
   * Field key (or composite key array) used as the canonical display name
   * for records of this entity. Used by the platform for detail page
   * headers, lookup labels, audit logs, and notifications. Always present —
   * defaults to `'id'` if no `isLabel: true` field is declared.
   */
  nameField: string | string[];

  /**
   * Field key used as the subtitle for records on detail page headers and
   * list/board cards. The api includes this column in LIST select maps so
   * the frontend always has the data, even if the field is not otherwise
   * `listVisible`. Pure data-shape hint — no presentation concerns.
   */
  subtitleField?: string;

  // --- Data access ---

  /** Row-level data access configuration. Controls which records users can see based on their RBAC scope. */
  dataAccess?: DataAccessConfig;
}

/**
 * Result of `EntityService.validateTransition` — a frozen, validated
 * transition ready to apply. Downstream phases (`applyTransition`,
 * `emitTransitionEvent`) accept this shape. Domain services owning their
 * own tx for a cascade pass the same object through all three phases so
 * derived fields stay consistent (the entity snapshot, the transition
 * definition lookup, etc.).
 */
export interface TransitionContext {
  entityType: string;
  entityId: string;
  fieldKey: string;
  fieldName: string;
  fromState: string;
  toState: string;
  transitionId: string;
  transitionName: string;
  workflowDefinitionId: string;
  workflowSlug: string;
  actorId: string;
  reason?: string;
  comment?: string;
  entity: Record<string, unknown>;
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
  /** Additional entity-specific query params — hand-written services may translate these into `filters` before calling the engine. */
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
  /** Tag group slug (for tags field type — used to fetch filter options) */
  tagGroupSlug?: string;
  /** Category group slug (for category field type — used to fetch filter options) */
  categoryGroupSlug?: string;
  /** Named cell renderer key (looked up in EntityEngineProvider registry) */
  cellRenderer?: string;
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
  /**
   * Field key (or composite key array) used for display name. Lifted out of
   * the `ui` block so it is independent of presentation hints — see
   * {@link EntityConfig.nameField}.
   */
  nameField: string | string[];
  /** Field key used as the subtitle. Mirrors {@link EntityConfig.subtitleField}. */
  subtitleField?: string;
  /**
   * Engine-derived feature flags merged with feature-package-derived keys
   * and the entity's opaque addon `features` bag. Engine keys are typed
   * below; feature-package keys (workflows, ...) and addon keys come from
   * registered derivers / `EntityConfig.features` verbatim and are read
   * by the package that owns them via its own reader.
   */
  features: {
    softDelete: boolean;
    restore: boolean;
    customFields: boolean;
    adminConfigurable: boolean;
    hasTaxonomy: boolean;
    hasMedia: boolean;
    [key: string]: unknown;
  };
  relationships: Omit<EntityRelationship, 'junctionEntity'>[];
}
