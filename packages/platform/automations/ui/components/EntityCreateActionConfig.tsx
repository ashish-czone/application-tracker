import { useMemo, useCallback } from 'react';
import { FormProvider } from 'react-hook-form';
import { FormSelect } from '@packages/ui';
import type { FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityLayout } from '@packages/entity-engine-ui';
import { useEntities } from '../hooks';
import { useActionFieldsForm } from '../useActionFieldsForm';
import { FieldValueInput } from './FieldValueInput';

interface EntityCreateActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** Entity type of the triggering event — used for dynamic field mapping */
  sourceEntityType?: string;
  /** When set, the entity type is fixed by the caller (e.g. via a per-entity action shortcut) and the picker is hidden. */
  lockedEntityType?: string;
}

/**
 * Action config component for the "create_entity" action type.
 * Renders:
 * 1. Entity type picker (required)
 * 2. Dynamic entity form fields based on the selected entity's layout
 * 3. Each field supports static value or dynamic mapping from trigger payload
 */
export function EntityCreateActionConfig({ config, onChange, sourceEntityType, lockedEntityType }: EntityCreateActionConfigProps) {
  const { data: entities } = useEntities();

  const selectedEntityType = lockedEntityType ?? (config.entityType as string) ?? '';
  const existingFields = (config.fields as Record<string, unknown>) ?? {};

  const entityOptions = useMemo(() => {
    return (entities ?? []).map((e) => ({ value: e.entityType, label: e.entityType }));
  }, [entities]);

  const handleEntityTypeChange = (entityType: string) => {
    onChange({ entityType, fields: {} });
  };

  // Fetch layout for the selected entity type (target)
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(selectedEntityType);

  // Fetch layout for the triggering entity type (source) for dynamic mapping
  const { data: sourceLayout } = useEntityLayout(sourceEntityType ?? '');

  const sourceFields = useMemo(() => {
    if (!sourceLayout) return [];
    return sourceLayout.sections.flatMap((s) => s.fields);
  }, [sourceLayout]);

  // Get editable fields from the layout
  const editableFields = useMemo(() => {
    if (!layout) return [];
    return layout.sections
      .flatMap((s) => s.fields)
      .filter((f) => !f.isReadonly && f.fieldType !== 'auto_number');
  }, [layout]);

  return (
    <div className="space-y-3">
      {!lockedEntityType && (
        <FormSelect
          value={selectedEntityType}
          onChange={handleEntityTypeChange}
          options={entityOptions}
          label="Entity Type"
          placeholder="Select entity type to create..."
        />
      )}

      {selectedEntityType && layoutLoading && (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      )}

      {selectedEntityType && editableFields.length > 0 && (
        <EntityFieldsForm
          key={`${selectedEntityType}-${editableFields.length}`}
          editableFields={editableFields}
          existingFields={existingFields}
          selectedEntityType={selectedEntityType}
          sourceFields={sourceFields}
          onChange={onChange}
        />
      )}

      {selectedEntityType && !layoutLoading && editableFields.length === 0 && (
        <p className="text-sm text-muted-foreground">No fields configured for this entity type.</p>
      )}
    </div>
  );
}

/**
 * Inner form component — keyed by entity type so useForm is recreated
 * with correct defaultValues when the entity changes.
 */
function EntityFieldsForm({
  editableFields,
  existingFields,
  selectedEntityType,
  sourceFields,
  onChange,
}: {
  editableFields: FieldDefinition[];
  existingFields: Record<string, unknown>;
  selectedEntityType: string;
  sourceFields: FieldDefinition[];
  onChange: (config: Record<string, unknown>) => void;
}) {
  const onFieldsChange = useCallback((fields: Record<string, unknown>) => {
    onChange({ entityType: selectedEntityType, fields });
  }, [selectedEntityType, onChange]);

  const { form, getFieldInputProps } = useActionFieldsForm({
    activeFields: editableFields,
    existingFields,
    sourceFields,
    onFieldsChange,
  });

  return (
    <FormProvider {...form}>
      <div className="grid grid-cols-2 gap-3">
        {editableFields.map((field) => (
          <FieldValueInput key={field.fieldKey} {...getFieldInputProps(field)} />
        ))}
      </div>
    </FormProvider>
  );
}
