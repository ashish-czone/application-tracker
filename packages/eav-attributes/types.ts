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
  | 'auto_number';

/** Maps field types to EAV value columns */
export type EavValueColumn = 'valueText' | 'valueNumber' | 'valueDate' | 'valueDatetime' | 'valueBoolean';

/** Which EAV column each field type writes to */
export const FIELD_TYPE_TO_VALUE_COLUMN: Record<FieldType, EavValueColumn> = {
  text: 'valueText',
  email: 'valueText',
  phone: 'valueText',
  url: 'valueText',
  textarea: 'valueText',
  picklist: 'valueText',
  multi_select: 'valueText', // stored as JSON array string
  lookup: 'valueText',       // stores the referenced entity ID
  user: 'valueText',         // stores the user ID
  auto_number: 'valueText',
  number: 'valueNumber',
  currency: 'valueNumber',
  decimal: 'valueNumber',
  date: 'valueDate',
  datetime: 'valueDatetime',
  boolean: 'valueBoolean',
};

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

export interface FullLayout {
  entityType: string;
  layoutName: string;
  sections: FullLayoutSection[];
  quickCreateFields: FullLayoutField[];
}

// --- EAV filtering ---

export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'contains';

export interface FieldFilter {
  fieldKey: string;
  operator: FilterOperator;
  value: unknown;
}

// --- Lookup resolution ---

export interface LookupConfig {
  entity: string;
  table: any;
  labelField: string;
  valueField: string;
  searchFields: string[];
}

export interface LookupResult {
  label: string;
  value: string;
}

// --- Registration input types ---

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
  sortOrder?: number;
}

export interface SeedSectionInput {
  name: string;
  columns?: number;
  isCollapsible?: boolean;
  isTabular?: boolean;
  tabularMaxRows?: number;
  fields: string[]; // field_keys in order
}

export interface SetPicklistOptionInput {
  label: string;
  value: string;
  isDefault?: boolean;
}
