import { Plus, X } from 'lucide-react';
import { Button, Badge } from '@packages/ui';
import type { Condition, ConditionOperator, ConditionFieldConfig, RenderValueProps } from './types';

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'is',
  neq: 'is not',
  gt: 'greater than',
  lt: 'less than',
  in: 'is any of',
  is_null: 'is empty',
  is_not_null: 'is not empty',
  changed: 'changed',
  changed_to: 'changed to',
  changed_from_to: 'changed from \u2192 to',
};

const BASE_OPERATORS_BY_TYPE: Record<string, ConditionOperator[]> = {
  text: ['eq', 'neq', 'is_null', 'is_not_null'],
  number: ['eq', 'neq', 'gt', 'lt', 'is_null', 'is_not_null'],
  date: ['gt', 'lt', 'is_null', 'is_not_null'],
  enum: ['eq', 'neq', 'in'],
  boolean: ['eq', 'neq'],
  uuid: ['eq', 'neq', 'is_null', 'is_not_null'],
};

const PAYLOAD_OPERATORS: ConditionOperator[] = ['changed', 'changed_to', 'changed_from_to'];
const VALUE_TYPES_FOR_CHANGED = ['text', 'number', 'enum', 'boolean', 'uuid', 'date'];

export interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  fields: Record<string, ConditionFieldConfig>;
  /** When true, includes payload-change operators (changed, changed_to, changed_from_to) */
  includePayloadOperators?: boolean;
  /** Custom value renderer — when provided, replaces the default input for condition values */
  renderValue?: (props: RenderValueProps) => React.ReactNode;
}

function getOperatorsForType(fieldType: string, includePayload: boolean): ConditionOperator[] {
  const base = BASE_OPERATORS_BY_TYPE[fieldType] ?? BASE_OPERATORS_BY_TYPE.text;
  if (!includePayload) return base;

  const ops = [...base, 'changed' as ConditionOperator];
  if (VALUE_TYPES_FOR_CHANGED.includes(fieldType)) {
    ops.push('changed_to' as ConditionOperator, 'changed_from_to' as ConditionOperator);
  }
  return ops;
}

export function ConditionBuilder({ conditions, onChange, fields, includePayloadOperators = false, renderValue }: ConditionBuilderProps) {
  const fieldEntries = Object.entries(fields);

  function addCondition() {
    if (fieldEntries.length === 0) return;
    const [firstField] = fieldEntries[0];
    onChange([...conditions, { field: firstField, operator: 'eq', value: '' }]);
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updates: Partial<Condition>) {
    onChange(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  }

  if (fieldEntries.length === 0) {
    return <p className="text-sm text-muted-foreground">No filterable fields available.</p>;
  }

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => {
        const fieldConfig = fields[condition.field];
        const availableOperators = getOperatorsForType(fieldConfig?.type ?? 'text', includePayloadOperators);
        const isNoValueOp = ['is_null', 'is_not_null', 'changed'].includes(condition.operator);
        const isFromTo = condition.operator === 'changed_from_to';
        const needsValue = !isNoValueOp && !isFromTo;
        const fromToValue = isFromTo
          ? (condition.value as { from?: string; to?: string } | undefined) ?? { from: '', to: '' }
          : { from: '', to: '' };

        return (
          <div key={index} className="flex items-center gap-2 flex-wrap">
            {index > 0 && <Badge variant="outline" className="text-[10px]">AND</Badge>}

            <select
              value={condition.field}
              onChange={(e) => updateCondition(index, { field: e.target.value, value: '' })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {fieldEntries.map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>

            <select
              value={condition.operator}
              onChange={(e) => {
                const newOp = e.target.value as ConditionOperator;
                const resetValue = ['is_null', 'is_not_null', 'changed'].includes(newOp)
                  ? undefined
                  : newOp === 'changed_from_to'
                    ? { from: '', to: '' }
                    : '';
                updateCondition(index, { operator: newOp, value: resetValue });
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {availableOperators.map((op) => (
                <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
              ))}
            </select>

            {/* changed_from_to: two side-by-side inputs */}
            {isFromTo && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">From:</span>
                {renderValue
                  ? renderValue({ fieldKey: condition.field, fieldConfig, operator: condition.operator, value: fromToValue.from, onChange: (v) => updateCondition(index, { value: { ...fromToValue, from: v } }), slot: 'from' })
                  : renderValueInput(fieldConfig, String(fromToValue.from ?? ''), (v) => updateCondition(index, { value: { ...fromToValue, from: v } }), 'From')
                }
                <span className="text-xs text-muted-foreground">To:</span>
                {renderValue
                  ? renderValue({ fieldKey: condition.field, fieldConfig, operator: condition.operator, value: fromToValue.to, onChange: (v) => updateCondition(index, { value: { ...fromToValue, to: v } }), slot: 'to' })
                  : renderValueInput(fieldConfig, String(fromToValue.to ?? ''), (v) => updateCondition(index, { value: { ...fromToValue, to: v } }), 'To')
                }
              </div>
            )}

            {/* Standard value inputs */}
            {needsValue && (renderValue
              ? renderValue({ fieldKey: condition.field, fieldConfig, operator: condition.operator, value: condition.value, onChange: (v) => updateCondition(index, { value: v }) })
              : fieldConfig?.type === 'enum' && fieldConfig.options && condition.operator === 'in' ? (
                <select
                  multiple
                  value={Array.isArray(condition.value) ? condition.value : []}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                    updateCondition(index, { value: selected });
                  }}
                  className="h-16 rounded-md border border-input bg-background px-2 text-sm min-w-[120px]"
                >
                  {fieldConfig.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                renderValueInput(fieldConfig, String(condition.value ?? ''), (v) =>
                  updateCondition(index, { value: fieldConfig?.type === 'number' ? Number(v) : v }), 'Value')
              )
            )}

            <button
              type="button"
              onClick={() => removeCondition(index)}
              className="p-1 text-muted-foreground hover:text-destructive"
              aria-label="Remove condition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={addCondition}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Condition
      </Button>
    </div>
  );
}

function renderValueInput(
  fieldConfig: ConditionFieldConfig | undefined,
  value: string,
  onChange: (value: string) => void,
  placeholder: string,
) {
  if (fieldConfig?.type === 'enum' && fieldConfig.options) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">Select...</option>
        {fieldConfig.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  if (fieldConfig?.type === 'boolean') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  return (
    <input
      type={fieldConfig?.type === 'number' ? 'number' : fieldConfig?.type === 'date' ? 'date' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm w-32"
    />
  );
}
