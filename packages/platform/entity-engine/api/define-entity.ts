import { getTableColumns } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { hasSoftDeleteColumns } from '@packages/soft-delete';
import type {
  CustomFieldsMode,
  EntityConfig,
  EntityHooks,
  EntityRelationship,
  ExtensionOfConfig,
  EntityActions,
  DataAccessConfig,
  FieldMeta,
  FieldType,
  OnDeleteConfig,
  SeedSectionInput,
  SetPicklistOptionInput,
  WorkflowFieldConfig,
} from './types';
import { hasCustomFieldsColumn } from './helpers/custom-fields-column';

// ---------------------------------------------------------------------------
// Model field definition — the new per-field declaration API
// ---------------------------------------------------------------------------

export interface ModelField {
  /** Field type. Use 'belongsTo', 'hasOne', 'hasMany', or 'manyToMany' for relation shortcuts. */
  type: FieldType | 'belongsTo' | 'hasOne' | 'hasMany' | 'manyToMany';
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

  // --- Relations ---

  /** Target entity type for lookup/belongsTo/hasMany/manyToMany */
  entity?: string;
  /** Foreign key column on the target entity (for hasMany) */
  foreignKey?: string;
  /** Foreign key column on this entity (for belongsTo) */
  inverseForeignKey?: string;
  /** Junction entity type (for manyToMany) */
  junctionEntity?: string;
  /** Fields to show in the related list (for hasMany) */
  displayFields?: string[];
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

  /**
   * Deletion policy. Required on every entity — forces an explicit hard/soft/
   * restrict choice rather than inferring from schema. See `OnDeleteConfig`.
   *
   * `mode: 'soft'` requires the Drizzle table to spread `...softDeleteColumns()`
   * from `@packages/soft-delete`. `mode: 'hard' | 'restrict'` forbids those
   * columns. Mismatches fail at defineEntity() time with a clear message.
   */
  onDelete: OnDeleteConfig;
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
   * Mark this entity as hierarchical. Requires the Drizzle table to spread
   * `...hierarchyColumns(selfRef)` from `@packages/hierarchy` (providing
   * `parentId`, `path`, `depth` columns). When enabled: the three columns are
   * registered as system columns, and downstream service wiring (Task 2)
   * injects `HierarchyService` so the entity service gains `reparent()`,
   * `getAncestors()`, `getDescendants()` plus auto-maintained `path`/`depth`
   * on create. Default: false.
   */
  hierarchy?: boolean;

  // --- Field definitions ---

  /** Field definitions keyed by field key (camelCase matching Drizzle property name) */
  fields: Record<string, ModelField>;

  // --- Sort ---

  /** Default sort field key */
  defaultSort?: string;

  // --- Layout sections (for entity-layout) ---

  /** Default layout sections with field assignments. Only used when entity-layout is installed. */
  sections?: SeedSectionInput[];

  // --- UI ---

  ui: {
    /** Lucide icon name */
    icon: string;
    /** Sidebar nav group */
    navGroup?: string;
    /** Sidebar ordering within group */
    navOrder?: number;
    /** How the "Add" button works */
    createMode?: 'modal' | 'page' | 'wizard';
    /** Picklist field keys for board/kanban view */
    boardFields?: string[];
    /** Field key for subtitle display */
    subtitleField?: string;
  };

  // --- RBAC ---

  /** Additional permissions beyond CRUD */
  extraPermissions?: { action: string; description: string }[];

  // --- Events ---

  /** Additional events beyond created/updated/deleted */
  extraEvents?: { name: string; description: string }[];

  // --- Actions ---

  /** Configurable actions for list pages */
  actions?: EntityActions;

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
    maxFileSize?: number;
    acceptedMimeTypes?: string[];
    deleteMode?: 'soft' | 'hard';
  };

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
   * Each relationship can carry an optional `handler` that the engine invokes
   * in the same transaction as the parent entity on create/update/delete. This
   * is how side tables like `credentials` and `user_roles` are populated from
   * nested sub-payloads on the owning entity's DTO.
   */
  relationships?: EntityRelationship[];

  // --- Lifecycle hooks ---

  hooks?: EntityHooks;
}

// ---------------------------------------------------------------------------
// Relation field type mapping
// ---------------------------------------------------------------------------

/**
 * Merge field-derived relationships (from `fields.X: { type: 'hasMany' | ... }`)
 * with top-level `relationships` declared on `ModelDefinition`. Top-level entries
 * override field-derived ones when they share a `name`, so callers can migrate
 * gradually. The field-level shortcut is deprecated.
 */
function mergeRelationships(
  fromFields: EntityRelationship[],
  fromTopLevel: EntityRelationship[] | undefined,
): EntityRelationship[] | undefined {
  if (!fromTopLevel || fromTopLevel.length === 0) {
    return fromFields.length > 0 ? fromFields : undefined;
  }
  const byName = new Map<string, EntityRelationship>();
  for (const rel of fromFields) byName.set(rel.name, rel);
  for (const rel of fromTopLevel) byName.set(rel.name, rel);
  const merged = Array.from(byName.values());
  return merged.length > 0 ? merged : undefined;
}

const RELATION_TO_FIELD_TYPE: Record<string, FieldType> = {
  belongsTo: 'lookup',
  hasOne: 'lookup', // hasOne doesn't produce a fieldMeta entry — it becomes a relationship
  hasMany: 'lookup', // hasMany doesn't produce a fieldMeta entry — it becomes a relationship
  manyToMany: 'lookup',
};

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
 *   onDelete: { mode: 'soft' },
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
  const searchColumns: PgColumn[] = [];
  const sortableColumns: Record<string, PgColumn> = {};
  const relationships: EntityRelationship[] = [];
  const recipientFields: Record<string, { label: string }> = {};
  const listFields: string[] = [];
  // Infrastructure-only columns: excluded from field seeding and event snapshots.
  // createdAt/updatedAt/createdBy are NOT included — they are seeded as system fields
  // so users can filter/condition on them.
  const systemColumns: string[] = ['id'];
  let nameField: string | string[] = 'id';
  let defaultSort = model.defaultSort ?? 'createdAt';

  // Validate onDelete policy against table shape + register soft-delete columns
  // as system columns when the entity is soft-deletable.
  //
  // Extension entities (`extensionOf`) are exempt from the table-shape check:
  // soft-delete columns live on the parent table and the entity-service
  // soft-delete / restore paths flip the parent's columns, not the child's.
  // Requiring the child to spread softDeleteColumns would duplicate state the
  // parent already owns (and nothing writes to).
  const softCols = hasSoftDeleteColumns(model.table);
  if (!model.extensionOf) {
    if (model.onDelete.mode === 'soft' && !softCols) {
      throw new Error(
        `defineEntity({ onDelete: { mode: 'soft' } }) for '${model.slug}' requires the table to spread ` +
          `...softDeleteColumns() from @packages/soft-delete. Missing deletedAt / deletedBy columns.`,
      );
    }
    if (model.onDelete.mode !== 'soft' && softCols) {
      throw new Error(
        `defineEntity({ onDelete: { mode: '${model.onDelete.mode}' } }) for '${model.slug}' is incompatible ` +
          `with a table that spreads ...softDeleteColumns(). Either switch to mode 'soft' or remove the columns.`,
      );
    }
  }
  if (model.onDelete.mode === 'soft') {
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

  // Hierarchy: validate the table spreads hierarchyColumns() and register
  // parent_id / path / depth as system columns. Fails fast with a clear
  // message if the consumer enabled the flag but forgot the mixin.
  if (model.hierarchy) {
    const missing = (['parentId', 'path', 'depth'] as const).filter((k) => !columns[k]);
    if (missing.length > 0) {
      throw new Error(
        `defineEntity({ hierarchy: true }) for '${model.slug}' requires the table to spread ` +
          `...hierarchyColumns() from @packages/hierarchy. Missing columns: ${missing.join(', ')}.`,
      );
    }
    // parentId is user-editable (seeded as a lookup field below); only
    // path/depth are pure infrastructure.
    systemColumns.push('path', 'depth');
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
    const isRelation = field.type === 'hasMany' || field.type === 'hasOne' || field.type === 'manyToMany';

    // hasOne / hasMany / manyToMany: extract as relationship, don't create fieldMeta.
    // The FK lives on the child table — these are reverse relations with no column
    // on the parent. Write-side support is provided via an optional handler on the
    // relationship (wired at engine level, not at defineEntity).
    if (isRelation) {
      relationships.push({
        name: key,
        type: field.type as 'hasOne' | 'hasMany' | 'manyToMany',
        targetEntity: field.entity ?? key,
        foreignKey: field.foreignKey,
        inverseForeignKey: field.inverseForeignKey,
        junctionEntity: field.junctionEntity,
        label: field.label,
        displayFields: field.displayFields,
      });
      continue;
    }

    // Map belongsTo to lookup field type
    const fieldType: FieldType = field.type === 'belongsTo'
      ? 'lookup'
      : field.type as FieldType;

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

    // Collect searchable columns
    if (field.searchable && columns[key]) {
      searchColumns.push(columns[key] as PgColumn);
    }

    // Collect sortable columns
    if (field.sortable && columns[key]) {
      sortableColumns[key] = columns[key] as PgColumn;
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

  // Always make default sort sortable
  if (defaultSort && columns[defaultSort] && !sortableColumns[defaultSort]) {
    sortableColumns[defaultSort] = columns[defaultSort] as PgColumn;
  }

  return {
    entityType,
    singularName,
    pluralName,
    slug: model.slug,
    table: model.table,
    systemColumns,
    onDelete: model.onDelete,
    searchColumns,
    defaultSort,
    sortableColumns,
    fieldMeta,
    sections: model.sections ?? [],
    listFields: listFields.length > 0 ? listFields : undefined,
    lookup,
    relationships: mergeRelationships(relationships, model.relationships),
    recipientFields: Object.keys(recipientFields).length > 0 ? recipientFields : undefined,
    customFields: model.customFields,
    adminConfigurable: model.adminConfigurable,
    hierarchy: model.hierarchy,
    hasNotes: model.hasNotes,
    hasAttachments: model.hasAttachments,
    hasEvaluations: model.hasEvaluations,
    hasTags: model.hasTags,
    attachmentConfig: model.attachmentConfig,
    computedColumns: model.computedColumns,
    extensionColumns: model.extensionColumns,
    extensionOf: model.extensionOf,
    extraPermissions: model.extraPermissions,
    extraEvents: model.extraEvents,
    actions: model.actions,
    ui: {
      icon: model.ui.icon,
      nameField,
      subtitleField: model.ui.subtitleField,
      navGroup: model.ui.navGroup,
      navOrder: model.ui.navOrder,
      createMode: model.ui.createMode,
      boardFields: model.ui.boardFields,
    },
    dataAccess: model.dataAccess,
    hooks: model.hooks,
  };
}
