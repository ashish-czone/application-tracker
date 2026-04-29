import { getTableColumns } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { hasSoftDeleteColumns } from '@packages/soft-delete';
import type {
  CustomFieldsMode,
  EntityConfig,
  EntityRelationship,
  ExtensionOfConfig,
  EntityActions,
  DataAccessConfig,
  FieldMeta,
  FieldType,
  SeedSectionInput,
  SetPicklistOptionInput,
  WorkflowFieldConfig,
} from './types';
import { hasCustomFieldsColumn } from './helpers/custom-fields-column';

// ---------------------------------------------------------------------------
// Model field definition — the new per-field declaration API
// ---------------------------------------------------------------------------

export interface ModelField {
  /**
   * Field type. Must be a scalar/column type.
   *
   * Relations (belongsTo/hasOne/hasMany/manyToMany) are declared in the
   * top-level `relationships` array on ModelDefinition, not here. FK columns
   * are declared as `type: 'lookup'`.
   */
  type: FieldType;
  /** Display label */
  label: string;

  // --- Behavior ---

  /** Field value is required on create */
  required?: boolean;
  /** Field value must be unique across all entities */
  unique?: boolean;
  /** Field is read-only in forms */
  readonly?: boolean;
  /** System field — admins cannot remove */
  system?: boolean;
  /** Field is included in search queries */
  searchable?: boolean;
  /** Field is sortable in list view */
  sortable?: boolean;
  /** This field is used as the display label when the entity is referenced from elsewhere */
  isLabel?: boolean;
  /** Field appears on the quick-create form */
  quickCreate?: boolean;
  /** Field value can be used as a notification recipient */
  isRecipient?: boolean;

  // --- List view ---

  /** Whether the field is visible by default in the list view */
  listVisible?: boolean;
  /** Display order in the list view */
  listOrder?: number;
  /** Completely exclude this field from the list view (won't be fetched, won't appear in columns picker) */
  excludeFromList?: boolean;
  /**
   * Hide this field from the list columns picker while still fetching its value
   * (and resolved __label for lookups/users). Useful when a cellRenderer on
   * another field needs access to this field's value but the field itself is
   * not meant to be shown as its own column.
   */
  listColumnHidden?: boolean;

  // --- Validation ---

  /** Max length for text-based fields */
  maxLength?: number;
  /** Default value */
  defaultValue?: string;
  /** Custom UI widget type (e.g. 'color-picker') */
  uiType?: string;

  // --- Picklist ---

  /** Picklist options (for picklist/multi_select field types) */
  options?: SetPicklistOptionInput[];

  // --- Lookup (for lookup/multi_lookup/user/multi_user field types) ---

  /** Target entity type for lookup/multi_lookup/user/multi_user fields */
  entity?: string;
  /** Lookup label field (for lookup fields) */
  lookupLabelField?: string;
  /** Lookup search fields (for lookup fields) */
  lookupSearchFields?: string[];

  // --- Taxonomy ---

  /** Tag group slug (for tags field type) */
  tagGroupSlug?: string;
  /** Category group slug (for category field type) */
  categoryGroupSlug?: string;

  // --- File ---

  /** Accepted MIME types (for file field type) */
  accept?: string[];
  /** Max file size in bytes (for file field type) */
  maxFileSize?: number;

  // --- Workflow ---

  /** Workflow configuration (for workflow field type) */
  workflow?: WorkflowFieldConfig;

  // --- Display ---

  /** Named cell renderer for the list view (looked up in EntityEngineProvider registry) */
  cellRenderer?: string;
}

// ---------------------------------------------------------------------------
// Model definition — the new entity declaration API
// ---------------------------------------------------------------------------

export interface ModelDefinition<TTable extends PgTable = PgTable> {
  /** Drizzle table reference */
  table: TTable;
  /** URL slug + API route prefix (e.g. 'candidates') */
  slug: string;
  /** Singular display name. Derived from slug if not provided. */
  singularName?: string;
  /** Plural display name. Derived from slug if not provided. */
  pluralName?: string;

  // --- Model behaviors ---

  /** Enable timestamp tracking (createdAt/updatedAt columns) */
  timestamps?: boolean;
  /**
   * Enable dynamic custom fields for this entity. Default: none.
   * - `true` — JSONB mode (default storage). Requires the Drizzle table to
   *   spread `...customFieldsColumn()` so `custom_fields jsonb` exists. Values
   *   live inline on the row; one query loads row + all custom values.
   * - `'eav'` — legacy EAV opt-in. Values stored in the shared
   *   `entity_field_values` table via the eav-attributes addon.
   * - `false` / omitted — no custom fields.
   */
  customFields?: CustomFieldsMode;
  /**
   * Allow admins to customize this entity at runtime (layout, field visibility,
   * tags/categories/workflows). Default: false — the in-memory registry is the
   * source of truth, no field/layout seeding, no DB reads for definitions, and
   * the entity is hidden from admin-config screens. Set true to opt in to DB-backed
   * configuration. Independent of `customFields`.
   */
  adminConfigurable?: boolean;
  /**
   * Mark this entity as hierarchical. Requires the Drizzle table to expose
   * `parentId`, `path`, `depth` columns. When enabled: the three columns are
   * registered as system columns (hidden from forms and layout seeds), and
   * `parentId` is auto-seeded as a self-lookup field. Tree operations
   * (move, ancestors, descendants) are not provided by the engine — call
   * the hierarchy library directly from the owning module's service layer.
   * Default: false.
   */
  hierarchy?: boolean;

  /**
   * Mark this entity as orderable. Requires the Drizzle table to expose a
   * `sortOrder` integer column. When enabled: the column is registered as a
   * system column (hidden from forms and layout seeds), and the default list
   * sort is `sortOrder ASC, id ASC` unless overridden. Sort-order writes are
   * not provided by the engine — call the orderable library directly from
   * the owning module's service layer. Default: false.
   */
  orderable?: boolean;

  // --- Field definitions ---

  /** Field definitions keyed by field key (camelCase matching Drizzle property name) */
  fields: Record<string, ModelField>;

  // --- Sort ---

  /** Default sort field key */
  defaultSort?: string;

  // --- Layout sections (for entity-layout) ---

  /** Default layout sections with field assignments. Only used when entity-layout is installed. */
  sections?: SeedSectionInput[];

  // --- Display ---

  /** Field key used as record subtitle on detail headers and list cards. */
  subtitleField?: string;

  // --- RBAC ---

  /** Additional permissions beyond CRUD */
  extraPermissions?: { action: string; description: string; supportedScopes?: string[] }[];

  // --- Events ---

  /** Additional events beyond created/updated/deleted */
  extraEvents?: { name: string; description: string }[];

  // --- Actions ---

  /** Configurable actions for list pages */
  actions?: EntityActions;

  // --- Addon features ---

  /**
   * Opaque bag of per-entity addon configuration. Forwarded verbatim to the
   * registry; the engine never inspects keys. Compose with addon-supplied
   * helpers, e.g.
   * `features: { ...notesFeature(), ...attachmentsFeature({ maxFileSize: ... }) }`.
   */
  features?: Record<string, unknown>;

  // --- Computed columns ---

  /** SQL subquery expressions added to SELECT in list and detail queries. */
  computedColumns?: { name: string; expression: SQL; sourceFields?: string[] }[];

  // --- Extension-of (MTI / shared-key extension) ---

  /** Columns of THIS entity that are projected into every extension child
   *  by default. See EntityConfig.extensionColumns for semantics. */
  extensionColumns?: string[];

  /** Declares this entity as a 1-1 extension of another entity. The child's
   *  primary key doubles as a foreign key to the parent's id. */
  extensionOf?: ExtensionOfConfig;

  // --- Data access ---

  /** Row-level data access configuration. Controls which records users can see based on their RBAC scope. */
  dataAccess?: DataAccessConfig;

  // --- Relationships (Laravel/Rails style — declared separately from fields) ---

  /**
   * Entity relationships (belongsTo / hasOne / hasMany / manyToMany).
   * Declared at the top level, not inside `fields`. Field-level shortcuts
   * inside `fields` are deprecated and will be removed in a future change.
   *
   * The engine surfaces relationships in layout responses and registry
   * entries but does not run hooks for them on the write path. Modules
   * that compose with side tables (credentials, user_roles, etc.) own
   * their own write paths in hand-written services.
   */
  relationships?: EntityRelationship[];
}

// ---------------------------------------------------------------------------
// defineEntity() — converts ModelDefinition to EntityConfig
// ---------------------------------------------------------------------------

/**
 * Define an entity using the model-based API.
 * Returns an EntityConfig that can be passed to `EntityEngineModule.forEntity()`.
 *
 * ```typescript
 * const candidateModel = defineEntity({
 *   table: candidates,
 *   slug: 'candidates',
 *   fields: {
 *     firstName: { type: 'text', label: 'First Name', required: true, isLabel: true, searchable: true },
 *     email: { type: 'email', label: 'Email', unique: true, searchable: true },
 *     assigneeId: { type: 'belongsTo', label: 'Assignee', entity: 'users' },
 *   },
 *   ui: { icon: 'Users' },
 * });
 * ```
 */
export function defineEntity<TTable extends PgTable>(model: ModelDefinition<TTable>): EntityConfig<TTable> {
  const columns = getTableColumns(model.table);
  const slugTitleCase = model.slug.charAt(0).toUpperCase() + model.slug.slice(1);

  // Derive names from slug if not provided
  const singularName = model.singularName ?? slugTitleCase.replace(/s$/, '');
  const pluralName = model.pluralName ?? slugTitleCase;
  const entityType = model.slug;

  // Collect derived values from fields
  const fieldMeta: Record<string, FieldMeta> = {};
  const searchFields: string[] = [];
  const sortableFields: string[] = [];
  const recipientFields: Record<string, { label: string }> = {};
  const listFields: string[] = [];
  // Infrastructure-only columns: excluded from field seeding and event snapshots.
  // createdAt/updatedAt/createdBy are NOT included — they are seeded as system fields
  // so users can filter/condition on them.
  const systemColumns: string[] = ['id'];
  let nameField: string | string[] = 'id';
  // Orderable entities default to sorting by sort_order; stable tie-break on
  // id is applied downstream in EntityService.list. Consumers can override
  // via an explicit defaultSort.
  let defaultSort = model.defaultSort ?? (model.orderable ? 'sortOrder' : 'createdAt');

  // Soft-delete capability is derived from the table shape: any table that
  // spreads `...softDeleteColumns()` from @packages/soft-delete is treated as
  // soft-deletable. No EntityConfig flag — schema is the single source of
  // truth, mirroring how Django infers behavior from the model fields.
  //
  // Extension entities (`extensionOf`) inherit soft-delete from the parent
  // table; their own table doesn't carry the columns. Listing them as system
  // columns here keeps the parent's surfaced deletedAt/deletedBy out of
  // snapshots and forms.
  const softCols = hasSoftDeleteColumns(model.table);
  if (softCols || model.extensionOf) {
    systemColumns.push('deletedAt', 'deletedBy');
  }

  // Extension-of: validate the shared-key shape locally. Cross-entity
  // resolution (parent's extensionColumns, etc.) happens at registry
  // resolution time — this block only catches things visible from the
  // child's own config.
  if (model.extensionOf && model.extensionColumns) {
    throw new Error(
      `defineEntity for '${model.slug}' declares both 'extensionOf' and 'extensionColumns'. ` +
        `An entity cannot be both an extension child and a parent for other extensions.`,
    );
  }
  if (model.extensionOf) {
    const ext = model.extensionOf;
    if (typeof ext.entity !== 'string' || ext.entity.length === 0) {
      throw new Error(`defineEntity for '${model.slug}': extensionOf.entity must be a non-empty string.`);
    }
    if (typeof ext.foreignKey !== 'string' || ext.foreignKey.length === 0) {
      throw new Error(`defineEntity for '${model.slug}': extensionOf.foreignKey must be a non-empty string.`);
    }
    const fkColumn = columns[ext.foreignKey] as PgColumn | undefined;
    if (!fkColumn) {
      throw new Error(
        `defineEntity for '${model.slug}': extensionOf.foreignKey '${ext.foreignKey}' is not a column on the table.`,
      );
    }
    if (!fkColumn.primary) {
      throw new Error(
        `defineEntity for '${model.slug}': extensionOf.foreignKey '${ext.foreignKey}' must be the primary key ` +
          `of the table (shared-key extension pattern). Use a 'belongsTo' field instead if the child has its own id.`,
      );
    }
    if (!fkColumn.notNull) {
      throw new Error(
        `defineEntity for '${model.slug}': extensionOf.foreignKey '${ext.foreignKey}' must be NOT NULL.`,
      );
    }
    for (const k of ext.excludeColumns ?? []) {
      if (typeof k !== 'string' || k.length === 0) {
        throw new Error(`defineEntity for '${model.slug}': extensionOf.excludeColumns entries must be non-empty strings.`);
      }
    }
    for (const k of ext.extraColumns ?? []) {
      if (typeof k !== 'string' || k.length === 0) {
        throw new Error(`defineEntity for '${model.slug}': extensionOf.extraColumns entries must be non-empty strings.`);
      }
    }
    if (ext.parentDefaults && (typeof ext.parentDefaults !== 'object' || Array.isArray(ext.parentDefaults))) {
      throw new Error(`defineEntity for '${model.slug}': extensionOf.parentDefaults must be a plain object.`);
    }
  }
  if (model.extensionColumns) {
    if (!Array.isArray(model.extensionColumns)) {
      throw new Error(`defineEntity for '${model.slug}': extensionColumns must be an array of column keys.`);
    }
    for (const k of model.extensionColumns) {
      if (typeof k !== 'string' || k.length === 0) {
        throw new Error(`defineEntity for '${model.slug}': extensionColumns entries must be non-empty strings.`);
      }
      if (!columns[k]) {
        throw new Error(
          `defineEntity for '${model.slug}': extensionColumns includes '${k}', which is not a column on the table.`,
        );
      }
    }
  }

  // Hierarchy: validate the required columns exist and register path/depth
  // as system columns. The column shape is library-defined; the kernel only
  // checks the names so misconfigured entities fail fast at boot instead of
  // at first tree operation.
  if (model.hierarchy) {
    const missing = (['parentId', 'path', 'depth'] as const).filter((k) => !columns[k]);
    if (missing.length > 0) {
      throw new Error(
        `defineEntity({ hierarchy: true }) for '${model.slug}' requires the table to expose ` +
          `parentId, path, depth columns. Missing columns: ${missing.join(', ')}.`,
      );
    }
    // parentId is user-editable (seeded as a lookup field below); only
    // path/depth are pure infrastructure.
    systemColumns.push('path', 'depth');
  }

  // Orderable: validate sort_order exists and register it as a system
  // column. The column shape is library-defined; the kernel only checks the
  // name so misconfigured entities fail fast at boot.
  if (model.orderable) {
    if (!columns.sortOrder) {
      throw new Error(
        `defineEntity({ orderable: true }) for '${model.slug}' requires the table to expose ` +
          `a sortOrder column.`,
      );
    }
    systemColumns.push('sortOrder');
  }

  // JSONB custom-fields: validate the table spreads customFieldsColumn() and
  // register the column as a system column so it is never surfaced as a
  // user-editable field. 'eav' mode and false/undefined skip this check.
  if (model.customFields === true) {
    if (!hasCustomFieldsColumn(columns)) {
      throw new Error(
        `defineEntity({ customFields: true }) for '${model.slug}' requires the table to spread ` +
          `...customFieldsColumn() from @packages/entity-engine-api. Missing customFields column. ` +
          `Use customFields: 'eav' to opt into legacy EAV storage instead.`,
      );
    }
    systemColumns.push('customFields');
  }

  let sortOrder = 0;

  for (const [key, field] of Object.entries(model.fields)) {
    const fieldType: FieldType = field.type;

    // Build FieldMeta
    const meta: FieldMeta = {
      label: field.label,
      section: 'default',
      sortOrder: sortOrder++,
      fieldType,
      uiType: field.uiType,
      isQuickCreate: field.quickCreate,
      isSystem: field.system,
      isUnique: field.unique,
      isReadonly: field.readonly,
      maxLength: field.maxLength,
      defaultValue: field.defaultValue,
      picklistOptions: field.options,
      lookupEntity: field.entity,
      lookupLabelField: field.lookupLabelField,
      lookupSearchFields: field.lookupSearchFields,
      tagGroupSlug: field.tagGroupSlug,
      categoryGroupSlug: field.categoryGroupSlug,
      accept: field.accept,
      maxFileSize: field.maxFileSize,
      cellRenderer: field.cellRenderer,
      workflow: field.workflow,
      excludeFromList: field.excludeFromList,
      listColumnHidden: field.listColumnHidden,
    };

    fieldMeta[key] = meta;

    // Collect searchable / sortable field keys. Resolution to Drizzle columns
    // happens at registry-finalize time so the config stays loosely coupled
    // to schema artifacts.
    if (field.searchable && columns[key]) {
      searchFields.push(key);
    }
    if (field.sortable && columns[key]) {
      sortableFields.push(key);
    }

    // Collect label fields
    if (field.isLabel) {
      if (nameField === 'id') {
        nameField = key;
      } else if (typeof nameField === 'string') {
        nameField = [nameField, key];
      } else {
        (nameField as string[]).push(key);
      }
    }

    // Collect recipient fields
    if (field.isRecipient) {
      recipientFields[key] = { label: field.label };
    }

    // Collect list-visible fields
    if (field.listVisible) {
      listFields.push(key);
    }

    // Note: system: true fields are NOT added to systemColumns.
    // They are seeded into field_definitions with isSystem/isReadonly flags,
    // so they appear in conditions, filters, and views but can't be user-edited.
  }

  // Hierarchy: auto-inject parentId as a self-lookup field so forms, search,
  // and filters treat it like any other lookup. Skipped if the consumer
  // declared their own parentId field explicitly.
  if (model.hierarchy && !fieldMeta.parentId) {
    const primaryLabel = typeof nameField === 'string' && nameField !== 'id' ? nameField : undefined;
    fieldMeta.parentId = {
      label: `Parent ${singularName}`,
      section: 'default',
      sortOrder: sortOrder++,
      fieldType: 'lookup',
      lookupEntity: entityType,
      lookupLabelField: primaryLabel,
      isSystem: true,
    };
  }

  // Build lookup config from isLabel fields
  const labelFieldKeys = typeof nameField === 'string' ? [nameField] : nameField;
  const searchableKeys = Object.entries(model.fields)
    .filter(([, f]) => f.searchable)
    .map(([k]) => k);

  const lookup = nameField !== 'id'
    ? {
        labelField: typeof nameField === 'string' ? nameField : nameField[0],
        searchFields: searchableKeys.length > 0 ? searchableKeys : labelFieldKeys,
      }
    : undefined;

  // Always make default sort sortable. Registry resolution will produce a
  // PgColumn entry from this key.
  if (defaultSort && columns[defaultSort] && !sortableFields.includes(defaultSort)) {
    sortableFields.push(defaultSort);
  }

  return {
    entityType,
    singularName,
    pluralName,
    slug: model.slug,
    table: model.table,
    systemColumns,
    searchFields,
    defaultSort,
    sortableFields,
    fieldMeta,
    sections: model.sections ?? [],
    listFields: listFields.length > 0 ? listFields : undefined,
    lookup,
    relationships: model.relationships && model.relationships.length > 0 ? model.relationships : undefined,
    recipientFields: Object.keys(recipientFields).length > 0 ? recipientFields : undefined,
    customFields: model.customFields,
    adminConfigurable: model.adminConfigurable,
    hierarchy: model.hierarchy,
    orderable: model.orderable,
    features: model.features,
    computedColumns: model.computedColumns,
    extensionColumns: model.extensionColumns,
    extensionOf: model.extensionOf,
    extraPermissions: model.extraPermissions,
    extraEvents: model.extraEvents,
    actions: model.actions,
    nameField,
    subtitleField: model.subtitleField,
    dataAccess: model.dataAccess,
  };
}
