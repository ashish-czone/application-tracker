import { useMemo, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { buildFormSchema, type FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import { isDynamicValue } from './components/field-compatibility';

interface UseActionFieldsFormOptions {
  /** Fields currently being edited (all editable for create, selected subset for update) */
  activeFields: FieldDefinition[];
  /** Existing field values from saved action config */
  existingFields: Record<string, unknown>;
  /** Source fields from triggering entity for dynamic mapping */
  sourceFields: FieldDefinition[];
  /** Called when field values change — receives only the fields record */
  onFieldsChange: (fields: Record<string, unknown>) => void;
}

/**
 * Shared form logic for EntityCreateActionConfig and EntityUpdateActionConfig.
 *
 * Manages: form state, dynamic field tracking, lookup option fetching,
 * search callbacks, sync to parent, and resolvedLabel computation.
 */
export function useActionFieldsForm({
  activeFields,
  existingFields,
  sourceFields,
  onFieldsChange,
}: UseActionFieldsFormOptions) {
  const { apiFn } = useEntityEngine();

  // Track dynamic (Mustache) values outside the form
  const dynamicFieldsRef = useRef<Record<string, string>>(
    Object.fromEntries(
      Object.entries(existingFields).filter(([, val]) => isDynamicValue(val)) as [string, string][],
    ),
  );

  // --- Lookup options ---

  const lookupEntities = useMemo(() => {
    return activeFields
      .filter((f) => (f.fieldType === 'lookup' || f.fieldType === 'user') && f.lookupEntity)
      .map((f) => f.lookupEntity!);
  }, [activeFields]);

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

  // --- Form setup ---

  const staticFields = useMemo(() => {
    return activeFields.filter((f) => !isDynamicValue(existingFields[f.fieldKey]));
  }, [activeFields, existingFields]);

  const schema = useMemo(() => buildFormSchema(staticFields), [staticFields]);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of activeFields) {
      const existing = existingFields[field.fieldKey];
      defaults[field.fieldKey] = (existing && !isDynamicValue(existing))
        ? existing
        : field.defaultValue ?? '';
    }
    return defaults;
  }, [activeFields, existingFields]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Reset form when active fields change (e.g., Update's field picker)
  const activeKeys = activeFields.map((f) => f.fieldKey).join(',');
  useEffect(() => {
    const values: Record<string, unknown> = {};
    for (const field of activeFields) {
      const existing = existingFields[field.fieldKey];
      values[field.fieldKey] = (existing && !isDynamicValue(existing))
        ? existing
        : field.defaultValue ?? '';
    }
    form.reset(values);
  }, [activeKeys]);

  // --- Sync to parent ---

  const lastSyncRef = useRef('');
  const syncToParent = useCallback(() => {
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
    if (serialized !== lastSyncRef.current) {
      lastSyncRef.current = serialized;
      onFieldsChange(fields);
    }
  }, [form, onFieldsChange]);

  useEffect(() => {
    const subscription = form.watch(() => syncToParent());
    return () => subscription.unsubscribe();
  }, [form, syncToParent]);

  // --- Dynamic value handling ---

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

  /** Remove a field from dynamic tracking (used by Update's removeField). */
  const clearDynamicField = useCallback((fieldKey: string) => {
    const { [fieldKey]: _, ...rest } = dynamicFieldsRef.current;
    dynamicFieldsRef.current = rest;
  }, []);

  // --- Search callbacks ---

  const searchUsers = useCallback(async (query: string) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(
      `/users?search=${encodeURIComponent(query)}&limit=20`,
    );
    return res.data.map((u) => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }));
  }, [apiFn]);

  const searchLookup = useCallback(async (entity: string, query: string) => {
    return apiFn.get<{ label: string; value: string }[]>(
      `/lookups/${entity}?search=${encodeURIComponent(query)}&limit=20`,
    );
  }, [apiFn]);

  const searchTags = useCallback(async (groupSlug: string, query: string) => {
    return apiFn.get<{ label: string; value: string; color?: string }[]>(
      `/tags/group/${groupSlug}?search=${encodeURIComponent(query)}&limit=20`,
    );
  }, [apiFn]);

  // --- Props builder ---

  /** Returns all props needed for a <FieldValueInput> for the given field. */
  const getFieldInputProps = useCallback((field: FieldDefinition) => {
    const fieldValue = dynamicFieldsRef.current[field.fieldKey] ?? form.getValues(field.fieldKey);
    const options = field.lookupEntity ? lookupOptionsMap?.[field.lookupEntity] : undefined;
    const resolvedLabel = (!isDynamicValue(fieldValue) && options && fieldValue)
      ? options.find((o) => o.value === fieldValue)?.label ?? null
      : null;

    return {
      field,
      value: fieldValue,
      onDynamicChange: handleDynamicChange,
      sourceFields,
      lookupOptions: options,
      resolvedLabel,
      onSearch:
        field.fieldType === 'lookup' && field.lookupEntity
          ? (q: string) => searchLookup(field.lookupEntity!, q)
          : field.fieldType === 'user'
          ? searchUsers
          : undefined,
      onChipSearch:
        field.fieldType === 'multi_user' ? searchUsers
        : field.fieldType === 'multi_lookup' && field.lookupEntity ? (q: string) => searchLookup(field.lookupEntity!, q)
        : field.fieldType === 'tags' && field.tagGroupSlug ? (q: string) => searchTags(field.tagGroupSlug!, q)
        : undefined,
    };
  }, [handleDynamicChange, sourceFields, lookupOptionsMap, searchUsers, searchLookup, searchTags, form]);

  return { form, getFieldInputProps, clearDynamicField };
}
