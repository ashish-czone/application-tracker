import { useMemo, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Label, FormSelect } from '@packages/ui';
import { DynamicField, buildFormSchema, type FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityLayout, useEntityEngine } from '@packages/entity-engine-ui';
import { useEntities } from '../hooks';
import type { ApiFn } from '../../PlatformUIProvider';

interface EntityCreateActionConfigProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

/**
 * Action config component for the "create_entity" action type.
 * Renders:
 * 1. Entity type picker (required)
 * 2. Dynamic entity form fields based on the selected entity's layout
 */
export function EntityCreateActionConfig({ config, onChange }: EntityCreateActionConfigProps) {
  const { data: entities } = useEntities();
  const { apiFn } = useEntityEngine();

  const selectedEntityType = (config.entityType as string) ?? '';
  const existingFields = (config.fields as Record<string, unknown>) ?? {};

  const entityOptions = useMemo(() => {
    return (entities ?? []).map((e) => ({ value: e.entityType, label: e.entityType }));
  }, [entities]);

  const handleEntityTypeChange = (entityType: string) => {
    onChange({ entityType, fields: {} });
  };

  // Fetch layout for the selected entity type
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(selectedEntityType);

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
          onChange={onChange}
          apiFn={apiFn}
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
 * with correct defaultValues when the entity changes. This prevents
 * uncontrolled-to-controlled input warnings.
 */
function EntityFieldsForm({
  editableFields,
  existingFields,
  selectedEntityType,
  onChange,
  apiFn,
}: {
  editableFields: FieldDefinition[];
  existingFields: Record<string, unknown>;
  selectedEntityType: string;
  onChange: (config: Record<string, unknown>) => void;
  apiFn: ApiFn;
}) {
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

  const schema = useMemo(() => buildFormSchema(editableFields), [editableFields]);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of editableFields) {
      defaults[field.fieldKey] = existingFields[field.fieldKey] ?? field.defaultValue ?? '';
    }
    return defaults;
  }, [editableFields, existingFields]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Sync form changes to parent config
  const watchedValues = form.watch();
  useEffect(() => {
    if (editableFields.length === 0) return;
    const fields: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(watchedValues)) {
      if (val !== '' && val !== undefined && val !== null) {
        fields[key] = val;
      }
    }
    onChange({ entityType: selectedEntityType, fields });
  }, [watchedValues]);

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
          <DynamicField
            key={field.fieldKey}
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
        ))}
      </div>
    </FormProvider>
  );
}
