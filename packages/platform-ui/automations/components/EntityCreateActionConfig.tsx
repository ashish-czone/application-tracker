import { useMemo, useEffect, useCallback, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormSelect } from '@packages/ui';
import { buildFormSchema, type FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityLayout, useEntityEngine } from '@packages/entity-engine-ui';
import { useEntities } from '../hooks';
import { FieldValueInput } from './FieldValueInput';
import { isDynamicValue } from './field-compatibility';

interface EntityCreateActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** Entity type of the triggering event — used for dynamic field mapping */
  sourceEntityType?: string;
}

/**
 * Action config component for the "create_entity" action type.
 * Renders:
 * 1. Entity type picker (required)
 * 2. Dynamic entity form fields based on the selected entity's layout
 * 3. Each field supports static value or dynamic mapping from trigger payload
 */
export function EntityCreateActionConfig({ config, onChange, sourceEntityType }: EntityCreateActionConfigProps) {
  const { data: entities } = useEntities();

  const selectedEntityType = (config.entityType as string) ?? '';
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
      <FormSelect
        value={selectedEntityType}
        onChange={handleEntityTypeChange}
        options={entityOptions}
        label="Entity Type"
        placeholder="Select entity type to create..."
      />

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
  const { apiFn } = useEntityEngine();
  // Track which fields have dynamic values (outside the form)
  const dynamicFieldsRef = useRef<Record<string, string>>(
    Object.fromEntries(
      Object.entries(existingFields).filter(([, val]) => isDynamicValue(val)) as [string, string][],
    ),
  );

  // Fetch lookup options for reference fields
  const lookupEntities = useMemo(() => {
    return editableFields
      .filter((f) => (f.fieldType === 'lookup' || f.fieldType === 'user') && f.lookupEntity)
      .map((f) => f.lookupEntity!);
  }, [editableFields]);

  const { data: lookupOptionsMap } = useQuery({
    queryKey: ['lookups', ...lookupEntities],
    queryFn: async () => {
      const map: Record<string, { label: string; value: string }[]> = {};
      for (const entity of lookupEntities) {
        try {
          const results = await apiFn.get<{ label: string; value: string }[]>(`/lookups/${entity}?limit=100`);
          map[entity] = results;
        } catch {
          map[entity] = [];
        }
      }
      return map;
    },
    enabled: lookupEntities.length > 0,
  });

  // Only build schema for non-dynamic fields (dynamic fields bypass validation)
  const staticFields = useMemo(() => {
    return editableFields.filter((f) => !isDynamicValue(existingFields[f.fieldKey]));
  }, [editableFields, existingFields]);

  const schema = useMemo(() => buildFormSchema(staticFields), [staticFields]);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of editableFields) {
      const existing = existingFields[field.fieldKey];
      // Don't put dynamic values into the form — they're handled separately
      defaults[field.fieldKey] = (existing && !isDynamicValue(existing))
        ? existing
        : field.defaultValue ?? '';
    }
    return defaults;
  }, [editableFields, existingFields]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Sync form changes + dynamic values to parent config
  const lastSyncRef = useRef('');
  useEffect(() => {
    const subscription = form.watch((watchedValues) => {
      if (editableFields.length === 0) return;
      const fields: Record<string, unknown> = {};
      // Add static values from form
      for (const [key, val] of Object.entries(watchedValues)) {
        if (dynamicFieldsRef.current[key]) continue; // skip dynamic fields
        if (val !== '' && val !== undefined && val !== null) {
          fields[key] = val;
        }
      }
      // Add dynamic values
      for (const [key, val] of Object.entries(dynamicFieldsRef.current)) {
        fields[key] = val;
      }
      const serialized = JSON.stringify(fields);
      if (serialized !== lastSyncRef.current) {
        lastSyncRef.current = serialized;
        onChange({ entityType: selectedEntityType, fields });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, editableFields.length, selectedEntityType, onChange]);

  // Handle dynamic value changes (from FieldValueInput toggle/selection)
  const handleDynamicChange = useCallback((fieldKey: string, value: unknown) => {
    if (isDynamicValue(value)) {
      // Set dynamic value
      dynamicFieldsRef.current = { ...dynamicFieldsRef.current, [fieldKey]: value as string };
      // Clear the form field so it doesn't conflict
      (form as any).setValue(fieldKey, '');
    } else {
      // Switched back to static — remove from dynamic tracking
      const { [fieldKey]: _, ...rest } = dynamicFieldsRef.current;
      dynamicFieldsRef.current = rest;
      (form as any).setValue(fieldKey, value ?? '');
    }
    // Trigger a sync
    const watchedValues = form.getValues();
    const fields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(watchedValues)) {
      if (dynamicFieldsRef.current[key]) continue;
      if (val !== '' && val !== undefined && val !== null) {
        fields[key] = val;
      }
    }
    for (const [key, val] of Object.entries(dynamicFieldsRef.current)) {
      fields[key] = val;
    }
    const serialized = JSON.stringify(fields);
    lastSyncRef.current = serialized;
    onChange({ entityType: selectedEntityType, fields });
  }, [form, selectedEntityType, onChange]);

  // Async search callbacks
  const searchUsers = useCallback(async (query: string) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(`/users?search=${encodeURIComponent(query)}&limit=20`);
    return res.data.map((u) => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }));
  }, [apiFn]);

  const searchLookup = useCallback(async (entity: string, query: string) => {
    return apiFn.get<{ label: string; value: string }[]>(`/lookups/${entity}?search=${encodeURIComponent(query)}&limit=20`);
  }, [apiFn]);

  const searchTags = useCallback(async (groupSlug: string, query: string) => {
    return apiFn.get<{ label: string; value: string; color?: string }[]>(
      `/tags/group/${groupSlug}?search=${encodeURIComponent(query)}&limit=20`,
    );
  }, [apiFn]);

  return (
    <FormProvider {...form}>
      <div className="grid grid-cols-2 gap-3">
        {editableFields.map((field) => (
          <FieldValueInput
            key={field.fieldKey}
            field={field}
            value={dynamicFieldsRef.current[field.fieldKey] ?? form.getValues(field.fieldKey)}
            onDynamicChange={handleDynamicChange}
            sourceFields={sourceFields}
            lookupOptions={field.lookupEntity ? lookupOptionsMap?.[field.lookupEntity] : undefined}
            onSearch={
              field.fieldType === 'lookup' && field.lookupEntity
                ? (q: string) => searchLookup(field.lookupEntity!, q)
                : field.fieldType === 'user'
                ? searchUsers
                : undefined
            }
            onChipSearch={
              field.fieldType === 'multi_user' ? searchUsers
              : field.fieldType === 'multi_lookup' && field.lookupEntity ? (q: string) => searchLookup(field.lookupEntity!, q)
              : field.fieldType === 'tags' && field.tagGroupSlug ? (q: string) => searchTags(field.tagGroupSlug!, q)
              : undefined
            }
          />
        ))}
      </div>
    </FormProvider>
  );
}
