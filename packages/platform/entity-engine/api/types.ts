import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Condition } from '@packages/common';
import type { RelationHandler } from '@packages/entity-engine-contract';
import type { SoftDeleteMode, DependentStrategy } from '@packages/soft-delete';
import type { WorkflowGuardFn } from './extensions/workflow-extension.interface';

// ---------------------------------------------------------------------------
// Deletion policy
// ---------------------------------------------------------------------------

/**
 * Declarative deletion behavior for an entity. Required on every
 * `defineEntity({ onDelete })`. See @packages/soft-delete for the underlying
 * primitive.
 *
 * - `mode: 'hard'` — DELETE removes the row. No soft-delete columns allowed.
 * - `mode: 'soft'` — DELETE marks `deleted_at` / `deleted_by`. Table must
 *   spread `...softDeleteColumns()`.
 * - `mode: 'restrict'` — DELETE is refused when any declared dependent has
 *   live rows. Otherwise hard-deletes.
 *
 * `dependents` is keyed by the entity's hasMany/manyToMany relationship name
 * or by a target entity type. Each value selects how that relationship is
 * handled when the parent is deleted. Currently the entity-engine only
 * enforces `dependents` when a service opts into the executor; the
 * declaration is stored on the config for future automatic wiring.
 */
export interface OnDeleteConfig {
  mode: SoftDeleteMode;
  dependents?: Record<string, DependentStrategy>;
}

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
   * Validation and storage of these fields are the handler's responsibility
   * — the engine never writes them to the parent table.
   */
  nestedFields?: NestedRelationshipField[];
  /**
   * Optional write-side handler invoked by the engine when a matching nested
   * payload key is present in a create/update DTO. The handler owns the child
   * table (e.g. credentials, user_roles) — the engine never touches it.
   *
   * Handler methods run inside the same transaction as the parent entity
   * insert/update. Throwing from a handler rolls back the parent operation.
   */
  handler?: RelationHandler;
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

// RelationHandler + RelationHandlerContext live in @packages/entity-engine-contract
// so owning packages (auth, rbac) can implement handlers without a circular dep
// on entity-engine itself. Re-exported here for ergonomic access from inside the
// engine.
export type { RelationHandler, RelationHandlerContext } from '@packages/entity-engine-contract';

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
  /** Sidebar nav group. When multiple entities share a navGroup and set `groupRenderMode: 'tabs'`, the platform collapses them into a single nav link and renders a tabbed page. The URL slug is derived from the group label. */
  navGroup?: string;
  /** Sidebar ordering within group. When grouped via `groupRenderMode: 'tabs'`, also drives tab order. */
  navOrder?: number;
  /** How entities in the same `navGroup` are presented. `'tabs'` collapses all grouped entities into one nav link routed to a tabbed group page. Omit to render each entity as an individual sidebar link (current behavior). */
  groupRenderMode?: 'tabs';
  /** How the "Add" button works: 'modal' = quick-create dialog, 'page' = full create form page, 'wizard' = multi-step (one section per step). Default: 'modal' */
  createMode?: 'modal' | 'page' | 'wizard';
  /** Picklist field keys that can be used as board/kanban grouping. Enables board view toggle on list page. */
  boardFields?: string[];
  /** Route template used by the list page after a successful quick-create, instead of the default detail page. `:id` is interpolated with the created entity id — e.g. `/pages/:id/edit`. */
  afterCreateRoute?: string;
}

// ---------------------------------------------------------------------------
// Data access scopes — control which records a user can see
// ---------------------------------------------------------------------------

/**
 * A scope resolver provides a SQL condition that filters entity records
 * based on the user's data access scope. Domain-specific resolvers
 * return SQL directly — the platform never builds queries on behalf of the domain.
 */
export interface ScopeResolver {
  /** Unique key referenced by RBAC permission scopes (e.g. 'hiring-manager') */
  key: string;
  /** Human-readable label shown in RBAC admin UI */
  label: string;
  /** Returns a SQL WHERE condition that restricts visible records for this user */
  resolve(userId: string): Promise<SQL>;
}

/**
 * Data access configuration for an entity.
 * Controls how row-level visibility is enforced based on RBAC permission scopes.
 */
export interface DataAccessConfig {
  /**
   * The field that identifies the record owner.
   * Used by the built-in 'own' and 'team' scopes.
   * Defaults to 'createdBy' if not specified.
   */
  ownerField?: string;

  /**
   * Optional field referencing an org unit (team).
   * When set, built-in scope resolution generates:
   *   ownerField IN (visible users) OR teamField IN (visible org units)
   * This enables team-based assignment with hierarchical visibility.
   */
  teamField?: string;

  /**
   * Entity-specific scope resolvers.
   * These are referenced by RBAC permission scopes as 'scope:<key>'.
   * Each resolver returns a SQL condition applied to list/detail queries.
   */
  scopes?: ScopeResolver[];
}

/** Context passed to entity service methods for scope enforcement */
export interface DataAccessContext {
  userId: string;
  scope: string; // 'all' | 'descendants' | 'unit' | 'own' | custom key
}


/**
 * Resolves data access scope based on a user's org position.
 * Replaces TeamResolver with position-based scope resolution.
 * Injected into entity-engine as an optional global provider.
 */
export interface PositionScopeProvider {
  /** Returns the resolved scope string for a user on a given entity type */
  resolveScope(userId: string, entityType: string): Promise<string>;
  /** Returns the user IDs visible for the given scope, or null for 'all' or custom scopes */
  resolveUserIds(userId: string, scope: string): Promise<string[] | null>;
  /** Returns the org unit IDs visible for the given scope, or null for 'all' or custom scopes */
  resolveOrgUnitIds(userId: string, scope: string): Promise<string[] | null>;
}

/** Injection token for the optional PositionScopeProvider */
export const POSITION_SCOPE_PROVIDER = 'POSITION_SCOPE_PROVIDER';

// ---------------------------------------------------------------------------
// Extension-of — 1-1 extension entities that share a primary key with a parent
// ---------------------------------------------------------------------------

export interface ExtensionOfConfig {
  /** Parent entity type key. Must be registered and must declare `extensionColumns`. */
  entity: string;
  /** Column on THIS child's table that is both the primary key AND the
   *  foreign key to `<parent>.id`. The child and parent share the same id
   *  value (MTI / shared-key pattern). Validated at `defineEntity` time. */
  foreignKey: string;
  /** Columns to drop from the parent's `extensionColumns` for this child only. */
  excludeColumns?: string[];
  /** Additional parent columns to project into this child that are not in
   *  the parent's `extensionColumns`. Resolved against the parent table at
   *  registry-resolution time. */
  extraColumns?: string[];
  /** Column values written to the parent row at create time (e.g., a
   *  discriminator like `{ kind: 'compliance' }`). Accepted here in PR 1
   *  but applied on the write path in PR 2. */
  parentDefaults?: Record<string, unknown>;
}

/**
 * Resolved view of an extension entity's relationship to its parent. Built
 * by `EntityRegistryService.finalize()` after every entity has been
 * registered. Downstream services use this instead of re-walking the
 * config + parent table on every request.
 */
export interface ResolvedExtension {
  /** Convenience copy of `extensionOf.entity`. */
  parentEntityType: string;
  /** Parent's Drizzle table reference. */
  parentTable: PgTable;
  /** Child's primary-key-also-foreign-key column. */
  foreignKeyColumn: PgColumn;
  /** JS property name of `foreignKeyColumn` on the child table — used by the
   *  write path to key the FK into Drizzle insert values. */
  foreignKeyField: string;
  /** Parent's `id` column — RHS of the join condition. */
  parentIdColumn: PgColumn;
  /** Ordered projection of parent columns surfaced on the child's read
   *  shape. Order: `parent.extensionColumns` minus `excludeColumns`, then
   *  `extraColumns` appended in declared order. */
  projectedColumns: Array<{ fieldKey: string; column: PgColumn }>;
  /** Pass-through copy of `extensionOf.parentDefaults` for the write path. */
  parentDefaults: Record<string, unknown>;
}

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

  /** Deletion policy. Always present — every entity must declare hard/soft/restrict. */
  onDelete: OnDeleteConfig;

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

  /** Mark this entity as hierarchical. Requires the table to spread `...hierarchyColumns()`
   *  from `@packages/hierarchy`. Enables parent/child relations, path/depth maintenance,
   *  and HierarchyService-backed reparent/ancestor/descendant operations on the entity
   *  service (wired in EntityEngineModule). Default: false. */
  hierarchy?: boolean;

  /** Mark this entity as orderable. Requires the table to spread `...orderableColumns()`
   *  from `@packages/orderable`. Registers `sortOrder` as a system column, defaults
   *  list sort to `sortOrder ASC, id ASC`, and exposes a unified move endpoint that
   *  accepts `{ parentId?, sortOrder? }`. When combined with `hierarchy: true`, a
   *  single move call can reparent and reorder. Default: false. */
  orderable?: boolean;

  // --- Notes ---

  /** Enable the notes tab on the entity detail page. Default: false. */
  hasNotes?: boolean;

  // --- Attachments ---

  /** Enable the attachments tab on the entity detail page. Default: false. */
  hasAttachments?: boolean;

  // --- Evaluations ---

  /** Enable the evaluations tab on the entity detail page. Default: false. */
  hasEvaluations?: boolean;

  // --- Tags ---

  /**
   * Enable inline tagging on the entity detail page without declaring a `tags` field.
   * Renders an editable chip row in the detail header bound to the given tag group.
   */
  hasTags?: { groupSlug: string };

  /** Per-entity attachment configuration. Only relevant when hasAttachments is true. */
  attachmentConfig?: {
    /** Maximum file size in bytes. Default: 10MB (from media module). */
    maxFileSize?: number;
    /** Accepted MIME types. Default: all types. e.g., ['image/*', 'application/pdf'] */
    acceptedMimeTypes?: string[];
    /** How individual attachments are deleted. 'soft' marks deletedAt, 'hard' removes blob + row. Default: 'soft'. */
    deleteMode?: 'soft' | 'hard';
  };

  // --- Computed columns ---

  /** SQL subquery expressions added to SELECT in list and detail queries.
   *  Each entry becomes an extra column in the response (e.g., averageRating, evaluationsCount).
   *  Computed columns can also be used as sort keys. */
  computedColumns?: { name: string; expression: SQL; sourceFields?: string[] }[];

  // --- Extension-of (multi-table inheritance / shared-key extension) ---

  /** Column keys on THIS entity's table that are projected into every
   *  `extensionOf` child by default. Child entities can opt out per column
   *  via `extensionOf.excludeColumns`, or pull in additional parent columns
   *  via `extensionOf.extraColumns`. Keep this list to domain-meaningful
   *  fields only — platform plumbing like discriminator/idempotency columns
   *  should NOT be projected, so extensions never see them. */
  extensionColumns?: string[];

  /** Declares this entity as a 1-1 extension of another entity. The child's
   *  primary key must also be a foreign key to the parent's id (shared-key
   *  pattern). Read and write paths join through the foreign key and surface
   *  the parent's projected columns transparently. */
  extensionOf?: ExtensionOfConfig;

  // --- UI ---

  /** Frontend rendering hints (serialized to registry API) */
  ui: EntityUIHints;

  // --- Data access ---

  /** Row-level data access configuration. Controls which records users can see based on their RBAC scope. */
  dataAccess?: DataAccessConfig;

  // --- Lifecycle hooks ---

  hooks?: EntityHooks;
}

// ---------------------------------------------------------------------------
// Lifecycle hooks — domain-specific logic injected into the generic engine
// ---------------------------------------------------------------------------

export interface EntityHooks {
  /** Called before inserting a new entity. Can modify the payload. */
  beforeCreate?: (payload: Record<string, unknown>, actorId: string, tx?: any) => Promise<Record<string, unknown>>;
  /**
   * Called inside the create transaction, after the entity row has been inserted.
   * Receives the tx handle so side-writes (credentials, related rows) are atomic
   * with the entity insert. Throw to roll the whole create back.
   */
  inCreateTx?: (entityId: string, payload: Record<string, unknown>, actorId: string, tx: any) => Promise<void>;
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
  /**
   * Called after list rows are loaded and lookup labels resolved, before the
   * response is returned. Receives the whole page so batched enrichment (e.g.
   * fetching related rows in a single query) stays O(1). Runs outside any
   * transaction. Return the enriched rows.
   */
  afterList?: (
    rows: Record<string, unknown>[],
    ctx: { actorId: string },
  ) => Promise<Record<string, unknown>[]>;
  /**
   * Called after a single entity is loaded (findOne / detail) and lookup
   * labels are resolved, before the response is returned. Runs outside any
   * transaction. Return the enriched row.
   */
  afterFindOne?: (
    row: Record<string, unknown>,
    ctx: { actorId: string },
  ) => Promise<Record<string, unknown>>;
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
  ui: EntityUIHints;
  features: {
    softDelete: boolean;
    restore: boolean;
    customFields: boolean;
    adminConfigurable: boolean;
    hasTaxonomy: boolean;
    hasWorkflow: boolean;
    hasMedia: boolean;
    hasNotes: boolean;
    hasAttachments: boolean;
    hasEvaluations: boolean;
    hasTags?: { groupSlug: string };
    attachmentConfig?: {
      maxFileSize?: number;
      acceptedMimeTypes?: string[];
      deleteMode?: 'soft' | 'hard';
    };
    workflowDiscriminator: {
      key: string;
      label: string;
      options: { value: string; label: string }[];
      fieldName: string;
    } | null;
  };
  relationships: Omit<EntityRelationship, 'junctionEntity' | 'handler'>[];
}
