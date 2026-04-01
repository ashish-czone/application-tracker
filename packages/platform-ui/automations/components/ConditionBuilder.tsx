import { useMemo, useCallback } from 'react';
import { ConditionBuilder as BaseConditionBuilder, type ConditionFieldConfig, type RenderValueProps } from '../../conditions';
import { useEntityLayout } from '@packages/entity-engine-ui';
import type { FieldDefinition } from '@packages/eav-attributes-ui';
import { ConditionValueField } from './ConditionValueField';
import type { Condition, TriggerType } from '../types';

/** Map entity field types to the simplified condition type system for operator selection. */
const FIELD_TYPE_TO_CONDITION_TYPE: Record<string, ConditionFieldConfig['type']> = {
  text: 'text', email: 'text', phone: 'text', url: 'text', textarea: 'text',
  rich_text: 'text', auto_number: 'text',
  number: 'number', currency: 'number', decimal: 'number',
  date: 'date', datetime: 'date',
  boolean: 'boolean',
  picklist: 'enum', multi_select: 'enum', workflow: 'enum',
  lookup: 'uuid', multi_lookup: 'uuid', user: 'uuid', multi_user: 'uuid', category: 'uuid',
};

interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  fields: Record<string, ConditionFieldConfig>;
  entityType?: string;
  triggerType?: TriggerType;
}

export function ConditionBuilder({ conditions, onChange, fields, entityType, triggerType }: ConditionBuilderProps) {
  const { data: layout } = useEntityLayout(entityType ?? '');

  // Build field definitions map from layout (full FieldDefinition with picklist options, lookup info, etc.)
  const fieldDefsMap = useMemo<Record<string, FieldDefinition>>(() => {
    if (!layout) return {};
    const map: Record<string, FieldDefinition> = {};
    for (const section of layout.sections) {
      for (const field of section.fields) {
        map[field.fieldKey] = field;
      }
    }
    return map;
  }, [layout]);

  // Build condition field configs from layout (for operator selection and field labels)
  const resolvedFields = useMemo<Record<string, ConditionFieldConfig>>(() => {
    if (!layout) return fields;
    const result: Record<string, ConditionFieldConfig> = {};
    for (const section of layout.sections) {
      for (const field of section.fields) {
        const condType = FIELD_TYPE_TO_CONDITION_TYPE[field.fieldType] ?? 'text';
        result[field.fieldKey] = {
          type: condType,
          label: field.label,
          options: field.picklistOptions?.map((o) => o.value),
        };
      }
    }
    return result;
  }, [layout, fields]);

  const isSchedule = triggerType === 'schedule_once' || triggerType === 'schedule_recurring';

  // Custom value renderer using DynamicField when we have full field definitions
  const renderValue = useCallback((props: RenderValueProps) => {
    const fieldDef = fieldDefsMap[props.fieldKey];
    if (!fieldDef) return null;

    return (
      <ConditionValueField
        key={`${props.fieldKey}-${props.operator}${props.slot ? `-${props.slot}` : ''}`}
        field={fieldDef}
        value={props.value}
        onChange={props.onChange}
      />
    );
  }, [fieldDefsMap]);

  const hasFieldDefs = Object.keys(fieldDefsMap).length > 0;

  return (
    <BaseConditionBuilder
      conditions={conditions}
      onChange={onChange}
      fields={resolvedFields}
      includePayloadOperators={!isSchedule}
      renderValue={hasFieldDefs ? renderValue : undefined}
    />
  );
}
