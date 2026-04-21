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
}

export interface WorkflowTargetDef {
  state: string;
  requiredPermissions?: string[];
  guardNames?: string[];
  conditions?: Condition[];
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
 */
export interface FieldDef {
  type: FieldType | RelationFieldType;
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

  entity?: string;
  foreignKey?: string;
  inverseForeignKey?: string;
  junctionEntity?: string;
  displayFields?: string[];
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
