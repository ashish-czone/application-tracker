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

/** Field types that bypass the standard EAV pipeline (use join tables, external storage, or special handling) */
export const RELATIONAL_FIELD_TYPES = new Set<FieldType>(['tags', 'category', 'multi_user', 'multi_lookup']);

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
];

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
