import { useMemo, useEffect, useState, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X } from 'lucide-react';
import { Label, Input, FormSelect, Button } from '@packages/ui';
import { DynamicField, buildFormSchema, type FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityLayout, useEntityEngine } from '@packages/entity-engine-ui';
import { useEntities } from '../hooks';

interface EntityUpdateActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

/**
 * Action config component for the "update_entity" action type.
 * Renders:
 * 1. Optional entity type override (defaults to triggering entity)
 * 2. Optional entity ID override (supports mustache interpolation)
 * 3. Field picker — user selects which fields to set
 * 4. DynamicField for each selected field
 */
export function EntityUpdateActionConfig({ config, onChange }: EntityUpdateActionConfigProps) {
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

  // Fetch layout for the selected entity type
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(selectedEntityType);

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

  // Build form schema from selected fields only
  const schema = useMemo(() => {
    if (selectedFields.length === 0) return z.object({});
    return buildFormSchema(selectedFields);
  }, [selectedFields]);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of selectedFields) {
      defaults[field.fieldKey] = existingFields[field.fieldKey] ?? field.defaultValue ?? '';
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
      values[field.fieldKey] = existingFields[field.fieldKey] ?? field.defaultValue ?? '';
    }
    form.reset(values);
  }, [selectedFieldKeys.join(',')]);

  // Sync form changes to parent config
  const watchedValues = form.watch();
  useEffect(() => {
    if (selectedFields.length === 0) return;
    const fields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(watchedValues)) {
      if (selectedFieldKeys.includes(key) && val !== '' && val !== undefined && val !== null) {
        fields[key] = val;
      }
    }
    const currentFields = (config.fields as Record<string, unknown>) ?? {};
    if (JSON.stringify(fields) !== JSON.stringify(currentFields)) {
      onChange({
        ...(selectedEntityType ? { entityType: selectedEntityType } : {}),
        ...(entityId ? { entityId } : {}),
        fields,
      });
    }
  }, [watchedValues, selectedFields.length, selectedFieldKeys.join(',')]);

  const addField = (fieldKey: string) => {
    if (fieldKey && !selectedFieldKeys.includes(fieldKey)) {
      setSelectedFieldKeys((prev) => [...prev, fieldKey]);
    }
  };

  const removeField = (fieldKey: string) => {
    setSelectedFieldKeys((prev) => prev.filter((k) => k !== fieldKey));
    const { [fieldKey]: _, ...rest } = (config.fields as Record<string, unknown>) ?? {};
    onChange({ ...config, fields: rest });
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
                      <DynamicField
                        field={field}
                        mode="edit"
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
