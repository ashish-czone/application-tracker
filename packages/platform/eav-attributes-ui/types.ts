// Shared types for EAV UI components — mirrors backend types

export type FieldType =
  | 'text' | 'email' | 'phone' | 'number' | 'currency' | 'decimal'
  | 'date' | 'datetime' | 'boolean' | 'url' | 'textarea' | 'rich_text'
  | 'picklist' | 'multi_select' | 'lookup' | 'multi_lookup' | 'user' | 'multi_user'
  | 'auto_number' | 'tags' | 'file' | 'category' | 'workflow';

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
  tagGroupSlug: string | null;
  categoryGroupSlug: string | null;
  fileAccept: string[] | null;
  fileMaxSize: number | null;
  sortOrder: number;
  picklistOptions: PicklistOption[];
  columnIndex: number;
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

// Field type registry entry — matches backend FIELD_TYPE_REGISTRY
export interface FieldTypeRegistryEntry {
  type: FieldType;
  label: string;
  creatable: boolean;
  sortOrder: number;
  icon: string;
  color: string;
}

// Fallback config used when registry data hasn't loaded yet
export const FIELD_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  text: { label: 'Text', color: 'bg-blue-100 text-blue-800' },
  email: { label: 'Email', color: 'bg-indigo-100 text-indigo-800' },
  phone: { label: 'Phone', color: 'bg-violet-100 text-violet-800' },
  number: { label: 'Number', color: 'bg-emerald-100 text-emerald-800' },
  currency: { label: 'Currency', color: 'bg-green-100 text-green-800' },
  decimal: { label: 'Decimal', color: 'bg-emerald-100 text-emerald-800' },
  date: { label: 'Date', color: 'bg-amber-100 text-amber-800' },
  datetime: { label: 'DateTime', color: 'bg-amber-100 text-amber-800' },
  boolean: { label: 'Checkbox', color: 'bg-slate-100 text-slate-800' },
  url: { label: 'URL', color: 'bg-cyan-100 text-cyan-800' },
  textarea: { label: 'Multi-line', color: 'bg-blue-100 text-blue-800' },
  rich_text: { label: 'Rich Text', color: 'bg-blue-100 text-blue-800' },
  picklist: { label: 'Picklist', color: 'bg-orange-100 text-orange-800' },
  multi_select: { label: 'Multi-select', color: 'bg-orange-100 text-orange-800' },
  lookup: { label: 'Lookup', color: 'bg-purple-100 text-purple-800' },
  multi_lookup: { label: 'Multi-lookup', color: 'bg-purple-100 text-purple-800' },
  user: { label: 'User', color: 'bg-pink-100 text-pink-800' },
  multi_user: { label: 'Multi-user', color: 'bg-pink-100 text-pink-800' },
  auto_number: { label: 'Auto #', color: 'bg-gray-100 text-gray-800' },
  tags: { label: 'Tags', color: 'bg-teal-100 text-teal-800' },
  file: { label: 'File', color: 'bg-gray-100 text-gray-800' },
  category: { label: 'Category', color: 'bg-yellow-100 text-yellow-800' },
  workflow: { label: 'Workflow', color: 'bg-blue-100 text-blue-800' },
};

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
  tagGroupSlug?: string;
  categoryGroupSlug?: string;
  fileAccept?: string[];
  fileMaxSize?: number;
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
