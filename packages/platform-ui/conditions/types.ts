export type ConditionOperator = 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'is_null' | 'is_not_null' | 'changed' | 'changed_to' | 'changed_from_to';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export type ConditionFieldType = 'text' | 'number' | 'date' | 'enum' | 'uuid' | 'boolean';

export interface ConditionFieldConfig {
  type: ConditionFieldType;
  label: string;
  options?: string[];
}

export interface RenderValueProps {
  fieldKey: string;
  fieldConfig: ConditionFieldConfig;
  operator: ConditionOperator;
  value: unknown;
  onChange: (value: unknown) => void;
}
