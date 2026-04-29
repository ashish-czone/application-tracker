import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form, Button,
  DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@packages/ui';
import { DynamicField, buildFormSchema } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { useLookupHandlers } from '../helpers/useLookupHandlers';
import { resolveLookupValues } from '../helpers/resolveLookupValues';

interface EntityQuickCreateFormProps {
  entityType: string;
  singularName: string;
  onClose: () => void;
  onSuccess?: (entity: Record<string, unknown>) => void;
  /** Pre-fill field values (e.g., candidateId from parent context) */
  initialValues?: Record<string, unknown>;
}

/**
 * Generic quick-create form for any entity.
 * Renders fields marked as isQuickCreate from the entity's layout.
 * Uses @packages/ui form components via DynamicField.
 */
export function EntityQuickCreateForm({ entityType, singularName, onClose, onSuccess, initialValues }: EntityQuickCreateFormProps) {
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(entityType);
  const { apiFn, getFieldUI } = useEntityEngine();
  const hooks = useEntityHooks(entityType);
  const { onSearchFor, onChipSearchFor } = useLookupHandlers(entityType);

  // Fetch lookup options for all lookup fields
  const lookupEntities = useMemo(() => {
    if (!layout) return [];
    return layout.quickCreateFields
      .filter((f) => (f.fieldType === 'lookup' || f.fieldType === 'user') && f.lookupEntity)
      .map((f) => f.lookupEntity!);
  }, [layout]);

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

  const quickCreateFields = useMemo(
    () => layout?.quickCreateFields ?? [],
    [layout],
  );

  const schema = useMemo(
    () => buildFormSchema(quickCreateFields),
    [quickCreateFields],
  );

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of quickCreateFields) {
      defaults[field.fieldKey] = initialValues?.[field.fieldKey] ?? field.defaultValue ?? '';
    }
    return defaults;
  }, [quickCreateFields, initialValues]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const createMutation = hooks.useCreate({
    onSuccess: (entity) => {
      onClose();
      onSuccess?.(entity);
    },
  });

  async function onSubmit(data: Record<string, unknown>) {
    const resolved = await resolveLookupValues(data, quickCreateFields, apiFn, getFieldUI, entityType);
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(resolved)) {
      if (val !== '' && val !== undefined) {
        cleaned[key] = val;
      }
    }
    createMutation.mutate(cleaned);
  }

  if (layoutLoading) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add {singularName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      </>
    );
  }

  if (quickCreateFields.length === 0) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add {singularName}</DialogTitle>
          <DialogDescription>
            No quick create fields configured. Please set up quick create fields in Settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add {singularName}</DialogTitle>
        <DialogDescription>Quick create — you can add more details on the profile page</DialogDescription>
      </DialogHeader>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {quickCreateFields.map((field) => (
            <DynamicField
              key={field.fieldKey}
              field={field}
              mode="edit"
              lookupOptions={field.lookupEntity ? lookupOptionsMap?.[field.lookupEntity] : undefined}
              onSearch={onSearchFor(field)}
              onChipSearch={onChipSearchFor(field)}
            />
          ))}
        </div>

        {createMutation.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            {(createMutation.error as any)?.body?.message || `Failed to create ${singularName.toLowerCase()}.`}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : `Create ${singularName.toLowerCase()}`}
          </Button>
        </DialogFooter>
      </Form>
    </>
  );
}
