import { useMemo } from 'react';
import { Label, Input, FormSelect } from '@packages/ui';
import { useEntities } from '../hooks';

interface EntityDeleteActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** When set, the entity type is fixed by the caller and the picker is hidden. */
  lockedEntityType?: string;
}

export function EntityDeleteActionConfig({ config, onChange, lockedEntityType }: EntityDeleteActionConfigProps) {
  const { data: entities } = useEntities();

  const selectedEntityType = lockedEntityType ?? (config.entityType as string) ?? '';
  const entityId = (config.entityId as string) ?? '';

  const entityOptions = useMemo(() => {
    return [
      { value: '', label: 'Triggering entity (default)' },
      ...(entities ?? []).map((e) => ({ value: e.entityType, label: e.entityType })),
    ];
  }, [entities]);

  const handleEntityTypeChange = (entityType: string) => {
    onChange({ ...config, entityType: entityType || undefined });
  };

  const handleEntityIdChange = (value: string) => {
    onChange({
      ...(selectedEntityType ? { entityType: selectedEntityType } : {}),
      ...(value ? { entityId: value } : {}),
    });
  };

  return (
    <div className="space-y-3">
      {!lockedEntityType && (
        <FormSelect
          value={selectedEntityType}
          onChange={handleEntityTypeChange}
          options={entityOptions}
          label="Entity Type"
          placeholder="Triggering entity (default)"
        />
      )}

      <div className="space-y-2">
        <Label>Entity ID (optional, supports {'{{mustache}}'})</Label>
        <Input
          value={entityId}
          onChange={(e) => handleEntityIdChange(e.target.value)}
          placeholder="{{event.entityId}} (defaults to triggering entity)"
        />
      </div>
    </div>
  );
}
