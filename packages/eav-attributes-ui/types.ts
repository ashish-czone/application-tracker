// Shared types for EAV UI components — mirrors backend types

export type FieldType =
  | 'text' | 'email' | 'phone' | 'number' | 'currency' | 'decimal'
  | 'date' | 'datetime' | 'boolean' | 'url' | 'textarea'
  | 'picklist' | 'multi_select' | 'lookup' | 'user' | 'auto_number';

export interface PicklistOption {
  id: string;
  fieldId: string;
  label: string;
  value: string;
  isDefault: boolean;
  sortOrder: number;
}

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
  picklistOptions: PicklistOption[];
}

export interface LayoutSection {
  id: string;
  name: string;
  columns: number;
  sortOrder: number;
  isCollapsible: boolean;
  isTabular: boolean;
  tabularMaxRows: number | null;
  fields: FieldDefinition[];
}

export interface FullLayout {
  entityType: string;
  layoutName: string;
  sections: LayoutSection[];
  quickCreateFields: FieldDefinition[];
}

// Field type display config
export const FIELD_TYPE_CONFIG: Record<FieldType, { label: string; color: string }> = {
  text: { label: 'Text', color: 'bg-blue-100 text-blue-800' },
  email: { label: 'Email', color: 'bg-indigo-100 text-indigo-800' },
  phone: { label: 'Phone', color: 'bg-violet-100 text-violet-800' },
  number: { label: 'Number', color: 'bg-emerald-100 text-emerald-800' },
  currency: { label: 'Currency', color: 'bg-green-100 text-green-800' },
  decimal: { label: 'Decimal', color: 'bg-teal-100 text-teal-800' },
  date: { label: 'Date', color: 'bg-amber-100 text-amber-800' },
  datetime: { label: 'DateTime', color: 'bg-orange-100 text-orange-800' },
  boolean: { label: 'Checkbox', color: 'bg-pink-100 text-pink-800' },
  url: { label: 'URL', color: 'bg-sky-100 text-sky-800' },
  textarea: { label: 'Multi-line', color: 'bg-cyan-100 text-cyan-800' },
  picklist: { label: 'Picklist', color: 'bg-purple-100 text-purple-800' },
  multi_select: { label: 'Multi-select', color: 'bg-fuchsia-100 text-fuchsia-800' },
  lookup: { label: 'Lookup', color: 'bg-rose-100 text-rose-800' },
  user: { label: 'User', color: 'bg-red-100 text-red-800' },
  auto_number: { label: 'Auto #', color: 'bg-gray-100 text-gray-800' },
};

// Creatable field types (shown in palette)
export const CREATABLE_FIELD_TYPES: FieldType[] = [
  'text', 'number', 'email', 'phone', 'currency', 'date',
  'picklist', 'multi_select', 'boolean', 'url', 'textarea',
  'decimal', 'datetime', 'lookup',
];

// Callback types for components
export interface CreateFieldInput {
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  isRequired?: boolean;
  isUnique?: boolean;
  isQuickCreate?: boolean;
  isReadonly?: boolean;
  maxLength?: number;
  defaultValue?: string;
  lookupEntity?: string;
  lookupLabelField?: string;
  lookupSearchFields?: string[];
  picklistOptions?: { label: string; value: string; isDefault?: boolean }[];
}

export interface UpdateFieldInput {
  label?: string;
  isRequired?: boolean;
  isUnique?: boolean;
  isQuickCreate?: boolean;
  isReadonly?: boolean;
  maxLength?: number;
  defaultValue?: string;
  uiType?: string;
  sortOrder?: number;
}

export interface CreateSectionInput {
  name: string;
  columns?: number;
  isCollapsible?: boolean;
}

export interface PicklistOptionInput {
  label: string;
  value: string;
  isDefault?: boolean;
}
