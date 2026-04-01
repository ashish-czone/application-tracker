import { useMemo, useCallback } from 'react';
import {
  ConditionBuilder as BaseConditionBuilder,
  type ConditionFieldConfig,
  type RenderValueProps,
} from '@packages/platform-ui-conditions';
import type { Condition } from '@packages/platform-ui-conditions';
import type { FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { ConditionValueField } from './ConditionValueField';

/** Map entity field types to the simplified condition type system for operator selection. */
export const FIELD_TYPE_TO_CONDITION_TYPE: Record<string, ConditionFieldConfig['type']> = {
  text: 'text', email: 'text', phone: 'text', url: 'text', textarea: 'text',
  rich_text: 'text', auto_number: 'text',
  number: 'number', currency: 'number', decimal: 'number',
  date: 'date', datetime: 'date',
  boolean: 'boolean',
  picklist: 'enum', multi_select: 'enum', workflow: 'enum',
  lookup: 'uuid', multi_lookup: 'uuid', user: 'uuid', multi_user: 'uuid', category: 'uuid',
};

interface EntityConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  entityType?: string;
  /** When true, includes payload-change operators (changed, changed_to, changed_from_to) */
  includePayloadOperators?: boolean;
}

/**
 * Entity-aware condition builder that fetches the entity layout and renders
 * DynamicField-based value inputs with lookup/workflow resolution.
 */
export function EntityConditionBuilder({
  conditions,
  onChange,
  entityType,
  includePayloadOperators = false,
}: EntityConditionBuilderProps) {
  const { data: layout } = useEntityLayout(entityType ?? '');

  // Build field definitions map from layout
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

  // Build condition field configs from layout
  const resolvedFields = useMemo<Record<string, ConditionFieldConfig>>(() => {
    if (!layout) return {};
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
  }, [layout]);

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
      includePayloadOperators={includePayloadOperators}
      renderValue={hasFieldDefs ? renderValue : undefined}
    />
  );
}
