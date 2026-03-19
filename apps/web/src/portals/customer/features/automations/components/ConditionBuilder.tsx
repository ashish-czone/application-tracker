import { Plus, X } from 'lucide-react';
import { Button, Badge } from '@packages/ui';
import type { Condition, ConditionOperator, FieldConfig } from '../types';

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'equals',
  neq: 'not equals',
  gt: 'greater than',
  lt: 'less than',
  in: 'is in',
  is_null: 'is empty',
  is_not_null: 'is not empty',
};

const OPERATORS_BY_TYPE: Record<string, ConditionOperator[]> = {
  text: ['eq', 'neq', 'is_null', 'is_not_null'],
  number: ['eq', 'neq', 'gt', 'lt', 'is_null', 'is_not_null'],
  date: ['gt', 'lt', 'is_null', 'is_not_null'],
  enum: ['eq', 'neq', 'in'],
  boolean: ['eq', 'neq'],
  uuid: ['eq', 'neq', 'is_null', 'is_not_null'],
};

interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  fields: Record<string, FieldConfig>;
}

export function ConditionBuilder({ conditions, onChange, fields }: ConditionBuilderProps) {
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
    return <p className="text-sm text-muted-foreground">No filterable fields available for this entity.</p>;
  }

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => {
        const fieldConfig = fields[condition.field];
        const availableOperators = OPERATORS_BY_TYPE[fieldConfig?.type ?? 'text'] ?? OPERATORS_BY_TYPE.text;
        const needsValue = !['is_null', 'is_not_null'].includes(condition.operator);

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
              onChange={(e) => updateCondition(index, { operator: e.target.value as ConditionOperator })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {availableOperators.map((op) => (
                <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
              ))}
            </select>

            {needsValue && fieldConfig?.type === 'enum' && fieldConfig.options ? (
              condition.operator === 'in' ? (
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
                <select
                  value={String(condition.value ?? '')}
                  onChange={(e) => updateCondition(index, { value: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Select...</option>
                  {fieldConfig.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )
            ) : needsValue && fieldConfig?.type === 'boolean' ? (
              <select
                value={String(condition.value ?? '')}
                onChange={(e) => updateCondition(index, { value: e.target.value === 'true' })}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : needsValue ? (
              <input
                type={fieldConfig?.type === 'number' ? 'number' : fieldConfig?.type === 'date' ? 'date' : 'text'}
                value={String(condition.value ?? '')}
                onChange={(e) => updateCondition(index, {
                  value: fieldConfig?.type === 'number' ? Number(e.target.value) : e.target.value,
                })}
                placeholder="Value"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm w-32"
              />
            ) : null}

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
