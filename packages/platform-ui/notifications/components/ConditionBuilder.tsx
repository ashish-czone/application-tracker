import { useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Badge } from '@packages/ui';
import { useEntityFields } from '../hooks';
import type { Condition, ConditionOperator, FieldConfig, TriggerType, EntityField } from '../types';

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

const PAYLOAD_OPERATORS: ConditionOperator[] = ['changed', 'changed_to', 'changed_from_to'];
const VALUE_TYPES_FOR_CHANGED = ['text', 'number', 'enum', 'boolean', 'uuid', 'date'];

const BASE_OPERATORS_BY_TYPE: Record<string, ConditionOperator[]> = {
  text: ['eq', 'neq', 'is_null', 'is_not_null'],
  number: ['eq', 'neq', 'gt', 'lt', 'is_null', 'is_not_null'],
  date: ['gt', 'lt', 'is_null', 'is_not_null'],
  enum: ['eq', 'neq', 'in'],
  boolean: ['eq', 'neq'],
  uuid: ['eq', 'neq', 'is_null', 'is_not_null'],
};

function getOperatorsForType(fieldType: string, triggerType?: TriggerType): ConditionOperator[] {
  const base = BASE_OPERATORS_BY_TYPE[fieldType] ?? BASE_OPERATORS_BY_TYPE.text;
  const isSchedule = triggerType === 'schedule_once' || triggerType === 'schedule_recurring';
  if (isSchedule) return base;

  // For event triggers (or unspecified), add payload operators
  const ops = [...base, 'changed' as ConditionOperator];
  if (VALUE_TYPES_FOR_CHANGED.includes(fieldType)) {
    ops.push('changed_to' as ConditionOperator, 'changed_from_to' as ConditionOperator);
  }
  return ops;
}

/** Convert EntityField[] from the generic endpoint into Record<string, FieldConfig> */
function entityFieldsToFieldConfig(fields: EntityField[]): Record<string, FieldConfig> {
  const result: Record<string, FieldConfig> = {};
  for (const f of fields) {
    result[f.key] = {
      type: (BASE_OPERATORS_BY_TYPE[f.type] ? f.type : 'text') as FieldConfig['type'],
      label: f.label,
      options: f.options,
    };
  }
  return result;
}

interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  fields: Record<string, FieldConfig>;
  entityType?: string;
  triggerType?: TriggerType;
}

export function ConditionBuilder({ conditions, onChange, fields, entityType, triggerType }: ConditionBuilderProps) {
  const { data: entityFields } = useEntityFields(entityType);

  // If generic entity fields are available, use them; otherwise fall back to the static fields prop
  const resolvedFields = useMemo<Record<string, FieldConfig>>(() => {
    if (entityFields && entityFields.length > 0) {
      return entityFieldsToFieldConfig(entityFields);
    }
    return fields;
  }, [entityFields, fields]);

  const fieldEntries = Object.entries(resolvedFields);

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
        const fieldConfig = resolvedFields[condition.field];
        const availableOperators = getOperatorsForType(fieldConfig?.type ?? 'text', triggerType);
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
                {fieldConfig?.type === 'enum' && fieldConfig.options ? (
                  <select
                    value={String(fromToValue.from ?? '')}
                    onChange={(e) => updateCondition(index, { value: { ...fromToValue, from: e.target.value } })}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Select...</option>
                    {fieldConfig.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : fieldConfig?.type === 'boolean' ? (
                  <select
                    value={String(fromToValue.from ?? '')}
                    onChange={(e) => updateCondition(index, { value: { ...fromToValue, from: e.target.value } })}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    type={fieldConfig?.type === 'number' ? 'number' : fieldConfig?.type === 'date' ? 'date' : 'text'}
                    value={String(fromToValue.from ?? '')}
                    onChange={(e) => updateCondition(index, { value: { ...fromToValue, from: e.target.value } })}
                    placeholder="From"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm w-24"
                  />
                )}
                <span className="text-xs text-muted-foreground">To:</span>
                {fieldConfig?.type === 'enum' && fieldConfig.options ? (
                  <select
                    value={String(fromToValue.to ?? '')}
                    onChange={(e) => updateCondition(index, { value: { ...fromToValue, to: e.target.value } })}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Select...</option>
                    {fieldConfig.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : fieldConfig?.type === 'boolean' ? (
                  <select
                    value={String(fromToValue.to ?? '')}
                    onChange={(e) => updateCondition(index, { value: { ...fromToValue, to: e.target.value } })}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    type={fieldConfig?.type === 'number' ? 'number' : fieldConfig?.type === 'date' ? 'date' : 'text'}
                    value={String(fromToValue.to ?? '')}
                    onChange={(e) => updateCondition(index, { value: { ...fromToValue, to: e.target.value } })}
                    placeholder="To"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm w-24"
                  />
                )}
              </div>
            )}

            {/* Standard value inputs (eq, neq, changed_to, gt, lt, in) */}
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
