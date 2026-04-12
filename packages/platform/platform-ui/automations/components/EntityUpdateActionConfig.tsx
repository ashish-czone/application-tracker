import { useMemo, useState, useCallback } from 'react';
import { FormProvider } from 'react-hook-form';
import { X } from 'lucide-react';
import { Label, Input, FormSelect } from '@packages/ui';
import type { FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityLayout } from '@packages/entity-engine-ui';
import { useEntities } from '../hooks';
import { useActionFieldsForm } from '../useActionFieldsForm';
import { FieldValueInput } from './FieldValueInput';

interface EntityUpdateActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** Entity type of the triggering event — used for dynamic field mapping */
  sourceEntityType?: string;
  /** When set, the entity type is fixed by the caller (e.g. via a per-entity action shortcut) and the picker is hidden. */
  lockedEntityType?: string;
}

/**
 * Action config component for the "update_entity" action type.
 * Renders:
 * 1. Optional entity type override (defaults to triggering entity)
 * 2. Optional entity ID override (supports mustache interpolation)
 * 3. Field picker — user selects which fields to set
 * 4. FieldValueInput for each selected field (static or dynamic)
 */
export function EntityUpdateActionConfig({ config, onChange, sourceEntityType, lockedEntityType }: EntityUpdateActionConfigProps) {
  const { data: entities } = useEntities();

  const selectedEntityType = lockedEntityType ?? (config.entityType as string) ?? '';
  const entityId = (config.entityId as string) ?? '';
  const existingFields = (config.fields as Record<string, unknown>) ?? {};

  // Track which field keys the user has selected to update
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>(() =>
    Object.keys(existingFields),
  );

  const entityOptions = useMemo(() => {
    return [
      { value: '', label: 'Triggering entity (default)' },
      ...(entities ?? []).map((e) => ({ value: e.entityType, label: e.entityType })),
    ];
  }, [entities]);

  const handleEntityTypeChange = (entityType: string) => {
    setSelectedFieldKeys([]);
    onChange({ ...config, entityType: entityType || undefined, fields: {} });
  };

  const handleEntityIdChange = (value: string) => {
    onChange({ ...config, entityId: value || undefined });
  };

  // Fetch layout for the target entity type
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(selectedEntityType);

  // Fetch layout for the triggering entity type (source) for dynamic mapping
  const { data: sourceLayout } = useEntityLayout(sourceEntityType ?? '');

  const sourceFields = useMemo(() => {
    if (!sourceLayout) return [];
    return sourceLayout.sections.flatMap((s) => s.fields);
  }, [sourceLayout]);

  // Get all editable fields from the layout
  const allEditableFields = useMemo(() => {
    if (!layout) return [];
    return layout.sections
      .flatMap((s) => s.fields)
      .filter((f) => !f.isReadonly && f.fieldType !== 'auto_number');
  }, [layout]);

  // Fields available to add (not yet selected)
  const availableFieldOptions = useMemo(() => {
    return allEditableFields
      .filter((f) => !selectedFieldKeys.includes(f.fieldKey))
      .map((f) => ({ value: f.fieldKey, label: f.label }));
  }, [allEditableFields, selectedFieldKeys]);

  // The actual FieldDefinition objects for selected fields
  const selectedFields = useMemo(() => {
    return selectedFieldKeys
      .map((key) => allEditableFields.find((f) => f.fieldKey === key))
      .filter((f): f is FieldDefinition => !!f);
  }, [selectedFieldKeys, allEditableFields]);

  const onFieldsChange = useCallback((fields: Record<string, unknown>) => {
    onChange({
      ...(selectedEntityType ? { entityType: selectedEntityType } : {}),
      ...(entityId ? { entityId } : {}),
      fields,
    });
  }, [selectedEntityType, entityId, onChange]);

  const { form, getFieldInputProps, clearDynamicField } = useActionFieldsForm({
    activeFields: selectedFields,
    existingFields,
    sourceFields,
    onFieldsChange,
  });

  const addField = (fieldKey: string) => {
    if (fieldKey && !selectedFieldKeys.includes(fieldKey)) {
      setSelectedFieldKeys((prev) => [...prev, fieldKey]);
    }
  };

  const removeField = (fieldKey: string) => {
    setSelectedFieldKeys((prev) => prev.filter((k) => k !== fieldKey));
    clearDynamicField(fieldKey);
    const { [fieldKey]: _, ...restFields } = (config.fields as Record<string, unknown>) ?? {};
    onChange({ ...config, fields: restFields });
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

      {selectedEntityType && (
        <div className="space-y-2">
          <Label>Entity ID (optional, supports {"{{mustache}}"})</Label>
          <Input
            value={entityId}
            onChange={(e) => handleEntityIdChange(e.target.value)}
            placeholder="{{event.entityId}} (defaults to triggering entity)"
          />
        </div>
      )}

      {selectedEntityType && layoutLoading && (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      )}

      {selectedEntityType && allEditableFields.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="flex-shrink-0">Fields to update</Label>
            {availableFieldOptions.length > 0 && (
              <FormSelect
                value=""
                onChange={addField}
                options={availableFieldOptions}
                placeholder="Add field..."
                className="flex-1"
              />
            )}
          </div>

          {selectedFields.length > 0 && (
            <FormProvider {...form}>
              <div className="space-y-3">
                {selectedFields.map((field) => (
                  <div key={field.fieldKey} className="flex items-start gap-2">
                    <div className="flex-1">
                      <FieldValueInput {...getFieldInputProps(field)} />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeField(field.fieldKey)}
                      className="mt-7 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label={`Remove ${field.label}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </FormProvider>
          )}

          {selectedFields.length === 0 && (
            <p className="text-sm text-muted-foreground">Select fields to set values for.</p>
          )}
        </div>
      )}
    </div>
  );
}
