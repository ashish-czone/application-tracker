import { useEffect, useCallback, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { DynamicField } from '@packages/eav-attributes-ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import type { FieldDefinition } from '@packages/eav-attributes-ui';

interface ConditionValueFieldProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Renders a condition value input using DynamicField, wrapped in its own FormProvider.
 * Follows the same pattern as EntityCreateActionConfig for field rendering.
 */
export function ConditionValueField({ field, value, onChange }: ConditionValueFieldProps) {
  const { apiFn } = useEntityEngine();

  const form = useForm({
    defaultValues: { [field.fieldKey]: value ?? '' },
  });

  // Reset when the field changes (user picks a different condition field)
  useEffect(() => {
    form.reset({ [field.fieldKey]: value ?? '' });
  }, [field.fieldKey]);

  // Sync form value to parent
  const watched = form.watch(field.fieldKey);
  useEffect(() => {
    if (watched !== value) {
      onChange(watched);
    }
  }, [watched]);

  // Fetch lookup options for reference fields
  const lookupEntity = (field.fieldType === 'lookup' || field.fieldType === 'user') ? field.lookupEntity : null;
  const { data: lookupOptions } = useQuery({
    queryKey: ['condition-lookups', lookupEntity],
    queryFn: async () => {
      return apiFn.get<{ label: string; value: string }[]>(`/lookups/${lookupEntity}?limit=100`);
    },
    enabled: !!lookupEntity,
  });

  const searchUsers = useCallback(async (query: string) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(
      `/users?search=${encodeURIComponent(query)}&limit=20`,
    );
    return res.data.map((u) => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }));
  }, [apiFn]);

  const searchLookup = useCallback(async (query: string) => {
    if (!lookupEntity) return [];
    return apiFn.get<{ label: string; value: string }[]>(
      `/lookups/${lookupEntity}?search=${encodeURIComponent(query)}&limit=20`,
    );
  }, [apiFn, lookupEntity]);

  // Override field for condition context: no label (already shown in field selector),
  // not required, not readonly
  const conditionField = useMemo(() => ({
    ...field,
    label: '',
    isRequired: false,
    isReadonly: false,
  }), [field]);

  return (
    <FormProvider {...form}>
      <div className="min-w-[200px]">
        <DynamicField
          field={conditionField}
          mode="edit"
          lookupOptions={lookupEntity ? lookupOptions : undefined}
          onSearch={
            field.fieldType === 'lookup' && lookupEntity
              ? searchLookup
              : field.fieldType === 'user'
              ? searchUsers
              : undefined
          }
        />
      </div>
    </FormProvider>
  );
}
