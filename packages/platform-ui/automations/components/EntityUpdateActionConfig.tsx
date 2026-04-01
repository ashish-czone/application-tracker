import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { Label, Input, FormSelect, Button } from '@packages/ui';
import { buildFormSchema, type FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityLayout, useEntityEngine } from '@packages/entity-engine-ui';
import { useEntities } from '../hooks';
import { FieldValueInput } from './FieldValueInput';
import { isDynamicValue } from './field-compatibility';

interface EntityUpdateActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  /** Entity type of the triggering event — used for dynamic field mapping */
  sourceEntityType?: string;
}

/**
 * Action config component for the "update_entity" action type.
 * Renders:
 * 1. Optional entity type override (defaults to triggering entity)
 * 2. Optional entity ID override (supports mustache interpolation)
 * 3. Field picker — user selects which fields to set
 * 4. FieldValueInput for each selected field (static or dynamic)
 */
export function EntityUpdateActionConfig({ config, onChange, sourceEntityType }: EntityUpdateActionConfigProps) {
  const { data: entities } = useEntities();
  const { apiFn } = useEntityEngine();

  const selectedEntityType = (config.entityType as string) ?? '';
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

  // Track dynamic field values
  const dynamicFieldsRef = useRef<Record<string, string>>({});

  // Initialize dynamic fields from existing config
  useEffect(() => {
    const dynamic: Record<string, string> = {};
    for (const [key, val] of Object.entries(existingFields)) {
      if (isDynamicValue(val)) dynamic[key] = val as string;
    }
    dynamicFieldsRef.current = dynamic;
  }, []);

  // Fetch lookup options for reference fields in the selected set
  const lookupEntities = useMemo(() => {
    return selectedFields
      .filter((f) => (f.fieldType === 'lookup' || f.fieldType === 'user') && f.lookupEntity)
      .map((f) => f.lookupEntity!);
  }, [selectedFields]);

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

  // Build form schema from selected non-dynamic fields
  const staticSelectedFields = useMemo(() => {
    return selectedFields.filter((f) => !isDynamicValue(existingFields[f.fieldKey]));
  }, [selectedFields, existingFields]);

  const schema = useMemo(() => {
    if (staticSelectedFields.length === 0) return z.object({});
    return buildFormSchema(staticSelectedFields);
  }, [staticSelectedFields]);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of selectedFields) {
      const existing = existingFields[field.fieldKey];
      defaults[field.fieldKey] = (existing && !isDynamicValue(existing))
        ? existing
        : field.defaultValue ?? '';
    }
    return defaults;
  }, [selectedFields, existingFields]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Reset form when selected fields change
  useEffect(() => {
    const values: Record<string, unknown> = {};
    for (const field of selectedFields) {
      const existing = existingFields[field.fieldKey];
      values[field.fieldKey] = (existing && !isDynamicValue(existing))
        ? existing
        : field.defaultValue ?? '';
    }
    form.reset(values);
  }, [selectedFieldKeys.join(',')]);

  // Sync form + dynamic values to parent config
  const lastSyncRef = useRef('');
  const syncToParent = useCallback(() => {
    const watchedValues = form.getValues();
    const fields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(watchedValues)) {
      if (!selectedFieldKeys.includes(key)) continue;
      if (dynamicFieldsRef.current[key]) continue;
      if (val !== '' && val !== undefined && val !== null) {
        fields[key] = val;
      }
    }
    for (const [key, val] of Object.entries(dynamicFieldsRef.current)) {
      if (selectedFieldKeys.includes(key)) fields[key] = val;
    }
    const serialized = JSON.stringify(fields);
    if (serialized !== lastSyncRef.current) {
      lastSyncRef.current = serialized;
      onChange({
        ...(selectedEntityType ? { entityType: selectedEntityType } : {}),
        ...(entityId ? { entityId } : {}),
        fields,
      });
    }
  }, [form, selectedFieldKeys, selectedEntityType, entityId, onChange]);

  useEffect(() => {
    const subscription = form.watch(() => syncToParent());
    return () => subscription.unsubscribe();
  }, [form, syncToParent]);

  // Handle dynamic value changes
  const handleDynamicChange = useCallback((fieldKey: string, value: unknown) => {
    if (isDynamicValue(value)) {
      dynamicFieldsRef.current = { ...dynamicFieldsRef.current, [fieldKey]: value as string };
      (form as any).setValue(fieldKey, '');
    } else {
      const { [fieldKey]: _, ...rest } = dynamicFieldsRef.current;
      dynamicFieldsRef.current = rest;
      (form as any).setValue(fieldKey, value ?? '');
    }
    syncToParent();
  }, [form, syncToParent]);

  const addField = (fieldKey: string) => {
    if (fieldKey && !selectedFieldKeys.includes(fieldKey)) {
      setSelectedFieldKeys((prev) => [...prev, fieldKey]);
    }
  };

  const removeField = (fieldKey: string) => {
    setSelectedFieldKeys((prev) => prev.filter((k) => k !== fieldKey));
    const { [fieldKey]: _, ...restDynamic } = dynamicFieldsRef.current;
    dynamicFieldsRef.current = restDynamic;
    const { [fieldKey]: __, ...restFields } = (config.fields as Record<string, unknown>) ?? {};
    onChange({ ...config, fields: restFields });
  };

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
    <div className="space-y-3">
      <FormSelect
        value={selectedEntityType}
        onChange={handleEntityTypeChange}
        options={entityOptions}
        label="Entity Type"
        placeholder="Triggering entity (default)"
      />

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
                      <FieldValueInput
                        field={field}
                        value={dynamicFieldsRef.current[field.fieldKey] ?? (form.getValues as any)(field.fieldKey)}
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
