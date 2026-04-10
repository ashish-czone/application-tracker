import { EntityConditionBuilder } from '@packages/entity-engine-ui';
import type { Condition, TriggerType } from '../types';
import type { ConditionFieldConfig } from '@packages/platform-ui-conditions';

interface ConditionBuilderProps {
  conditions: Condition[];
  onChange: (conditions: Condition[]) => void;
  fields: Record<string, ConditionFieldConfig>;
  entityType?: string;
  triggerType?: TriggerType;
}

/**
 * Automations-specific wrapper that maps triggerType to includePayloadOperators.
 * Schedule triggers don't support payload change operators.
 */
export function ConditionBuilder({ conditions, onChange, entityType, triggerType }: ConditionBuilderProps) {
  const isSchedule = triggerType === 'schedule_once' || triggerType === 'schedule_recurring';

  return (
    <EntityConditionBuilder
      conditions={conditions}
      onChange={onChange}
      entityType={entityType}
      includePayloadOperators={!isSchedule}
    />
  );
}
