import { getTableColumns } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type {
  EntityConfig,
  EntityHooks,
  EntityRelationship,
  EntityActions,
  DataAccessConfig,
  FieldMeta,
  FieldType,
  SeedSectionInput,
  SetPicklistOptionInput,
  WorkflowFieldConfig,
} from './types';

// ---------------------------------------------------------------------------
// Model field definition — the new per-field declaration API
// ---------------------------------------------------------------------------

export interface ModelField {
  /** Field type. Use 'belongsTo' or 'hasMany' for relation shortcuts. */
  type: FieldType | 'belongsTo' | 'hasMany' | 'manyToMany';
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

  /** Enable soft delete (deletedAt/deletedBy columns) */
  softDelete?: boolean;
  /** Enable timestamp tracking (createdAt/updatedAt columns) */
  timestamps?: boolean;
  /** Enable dynamic custom fields (EAV storage). When true, admins can add custom fields and EAV value operations are active. Default: false. */
  customFields?: boolean;
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

  // --- Data access ---

  /** Row-level data access configuration. Controls which records users can see based on their RBAC scope. */
  dataAccess?: DataAccessConfig;

  // --- Lifecycle hooks ---

  hooks?: EntityHooks;
}

// ---------------------------------------------------------------------------
// Relation field type mapping
// ---------------------------------------------------------------------------

const RELATION_TO_FIELD_TYPE: Record<string, FieldType> = {
  belongsTo: 'lookup',
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
 *   softDelete: true,
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

  // Add soft-delete infrastructure columns
  if (model.softDelete !== false) {
    systemColumns.push('deletedAt', 'deletedBy');
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

  let sortOrder = 0;

  for (const [key, field] of Object.entries(model.fields)) {
    const isRelation = field.type === 'hasMany' || field.type === 'manyToMany';

    // hasMany/manyToMany: extract as relationship, don't create fieldMeta
    if (isRelation) {
      relationships.push({
        name: key,
        type: field.type as 'hasMany' | 'manyToMany',
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
    searchColumns,
    defaultSort,
    sortableColumns,
    fieldMeta,
    sections: model.sections ?? [],
    listFields: listFields.length > 0 ? listFields : undefined,
    lookup,
    relationships: relationships.length > 0 ? relationships : undefined,
    recipientFields: Object.keys(recipientFields).length > 0 ? recipientFields : undefined,
    customFields: model.customFields,
    hierarchy: model.hierarchy,
    hasNotes: model.hasNotes,
    hasAttachments: model.hasAttachments,
    hasEvaluations: model.hasEvaluations,
    hasTags: model.hasTags,
    attachmentConfig: model.attachmentConfig,
    computedColumns: model.computedColumns,
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
