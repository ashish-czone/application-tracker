import type { Condition } from '@packages/common';

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
  | 'workflow';

export type RelationFieldType = 'belongsTo' | 'hasOne' | 'hasMany' | 'manyToMany';

export interface PicklistOptionDef {
  label: string;
  value: string;
  isDefault?: boolean;
}

export interface WorkflowStateDef {
  name: string;
  label: string;
  color?: string;
  /**
   * Canonical states wired into code behaviour (e.g. `completed`,
   * `cancelled` — terminal states the engine treats specially). Admin UIs
   * must block rename/delete on these; admins can still add or reorder
   * non-system states around them.
   */
  isSystem?: boolean;
}

export interface WorkflowTargetDef {
  state: string;
  requiredPermissions?: string[];
  conditions?: Condition[];
  /** Require the actor to supply a reason (validated against `reasonOptions` if set). */
  reasonRequired?: boolean;
  /** Require the actor to supply a free-text comment. */
  commentRequired?: boolean;
  /** Constrained list of allowed values for `reason` — when set, reasons outside this list are rejected. */
  reasonOptions?: string[];
}

export interface WorkflowTransitionDef {
  from: string;
  to: (string | WorkflowTargetDef)[];
}

export interface WorkflowFieldConfig {
  slug: string;
  initialState: string;
  states: WorkflowStateDef[];
  transitions: WorkflowTransitionDef[];
}

/**
 * Per-field declaration shared across api/ui. Structurally compatible with
 * ModelField in @packages/entity-engine's defineEntity(), so a FieldMap
 * declared in a contracts package can be passed straight to defineEntity
 * on the api side.
 *
 * Relations (belongsTo/hasOne/hasMany/manyToMany) are NOT declared here —
 * they live in the top-level `relationships` array on the entity config.
 * A FieldDef describes a column or EAV value; it does not describe a
 * relationship. FK columns are declared as `type: 'lookup'`.
 */
export interface FieldDef {
  type: FieldType;
  label: string;

  required?: boolean;
  unique?: boolean;
  readonly?: boolean;
  system?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  isLabel?: boolean;
  quickCreate?: boolean;
  isRecipient?: boolean;

  listVisible?: boolean;
  listOrder?: number;
  excludeFromList?: boolean;
  listColumnHidden?: boolean;

  maxLength?: number;
  defaultValue?: string;
  uiType?: string;

  options?: PicklistOptionDef[];

  /** Target entity for lookup/multi_lookup/user/multi_user field types */
  entity?: string;
  lookupLabelField?: string;
  lookupSearchFields?: string[];

  tagGroupSlug?: string;
  categoryGroupSlug?: string;

  accept?: string[];
  maxFileSize?: number;

  workflow?: WorkflowFieldConfig;

  cellRenderer?: string;
}

export type FieldMap = Record<string, FieldDef>;
