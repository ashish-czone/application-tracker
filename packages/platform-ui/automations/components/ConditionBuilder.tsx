import { useMemo } from 'react';
import { ConditionBuilder as BaseConditionBuilder, type ConditionFieldConfig } from '../../conditions';
import { useEntityFields } from '../hooks';
import type { Condition, TriggerType, EntityField } from '../types';

const BASE_OPERATORS_BY_TYPE: Record<string, string[]> = {
  text: ['eq'], number: ['eq'], date: ['gt'], enum: ['eq'], boolean: ['eq'], uuid: ['eq'],
};

function entityFieldsToFieldConfig(fields: EntityField[]): Record<string, ConditionFieldConfig> {
  const result: Record<string, ConditionFieldConfig> = {};
  for (const f of fields) {
    result[f.key] = {
      type: (BASE_OPERATORS_BY_TYPE[f.type] ? f.type : 'text') as ConditionFieldConfig['type'],
      label: f.label,
      options: f.options,
    };
  }
  return result;
}

interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  fields: Record<string, ConditionFieldConfig>;
  entityType?: string;
  triggerType?: TriggerType;
}

export function ConditionBuilder({ conditions, onChange, fields, entityType, triggerType }: ConditionBuilderProps) {
  const { data: entityFields } = useEntityFields(entityType);

  const resolvedFields = useMemo<Record<string, ConditionFieldConfig>>(() => {
    if (entityFields && entityFields.length > 0) {
      return entityFieldsToFieldConfig(entityFields);
    }
    return fields;
  }, [entityFields, fields]);

  const isSchedule = triggerType === 'schedule_once' || triggerType === 'schedule_recurring';

  return (
    <BaseConditionBuilder
      conditions={conditions}
      onChange={onChange}
      fields={resolvedFields}
      includePayloadOperators={!isSchedule}
    />
  );
}
