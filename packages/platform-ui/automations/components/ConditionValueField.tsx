import { useEffect, useCallback, useMemo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { DynamicField } from '@packages/eav-attributes-ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import type { FieldDefinition, PicklistOption } from '@packages/eav-attributes-ui';

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

  // Fetch workflow states for workflow fields — they need to render as a picklist
  // of available states instead of "Managed by workflow"
  const isWorkflow = field.fieldType === 'workflow';
  const { data: workflowStates } = useQuery({
    queryKey: ['workflow-states', field.entityType, field.fieldKey],
    queryFn: async () => {
      const workflows = await apiFn.get<{ entityType: string; fieldName: string; states: { name: string; label: string }[] }[]>('/workflows');
      const match = workflows.find(w => w.entityType === field.entityType && w.fieldName === field.fieldKey);
      return match?.states ?? [];
    },
    enabled: isWorkflow,
    staleTime: 5 * 60 * 1000,
  });

  // Override field for condition context: no label (already shown in field selector),
  // not required, not readonly.
  // Workflow fields render as picklist — users select a state value to compare against.
  const conditionField = useMemo(() => {
    const base = {
      ...field,
      label: '',
      isRequired: false,
      isReadonly: false,
    };

    if (isWorkflow && workflowStates) {
      return {
        ...base,
        fieldType: 'picklist' as const,
        picklistOptions: workflowStates.map((s, i) => ({
          id: s.name,
          fieldId: field.id,
          label: s.label,
          value: s.name,
          isDefault: false,
          sortOrder: i,
        })) as PicklistOption[],
      };
    }

    return base;
  }, [field, isWorkflow, workflowStates]);

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
