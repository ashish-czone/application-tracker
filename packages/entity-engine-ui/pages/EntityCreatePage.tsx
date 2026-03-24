import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Form, Button } from '@packages/ui';
import { DynamicField, buildFormSchema } from '@packages/eav-attributes-ui';
import type { FullLayoutField } from '@packages/eav-attributes';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';

interface EntityCreatePageProps {
  entityType: string;
}

/**
 * Full-page create form for entities with createMode: 'page'.
 * Renders ALL fields organized by layout sections (not just quick-create fields).
 */
export function EntityCreatePage({ entityType }: EntityCreatePageProps) {
  const navigate = useNavigate();
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { apiFn } = useEntityEngine();
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(entityType);

  // All editable fields (exclude auto_number, readonly, file, tags, multi_user, multi_lookup)
  const editableFields = useMemo(() => {
    if (!layout) return [];
    return layout.sections.flatMap((s) => s.fields).filter(
      (f) => !f.isReadonly && f.fieldType !== 'auto_number',
    );
  }, [layout]);

  // Fetch lookup options for lookup/user fields
  const lookupEntities = useMemo(() => {
    if (!editableFields.length) return [];
    return editableFields
      .filter((f) => (f.fieldType === 'lookup' || f.fieldType === 'user') && f.lookupEntity)
      .map((f) => f.lookupEntity!);
  }, [editableFields]);

  const { data: lookupOptionsMap } = useQuery({
    queryKey: ['lookups-create', ...lookupEntities],
    queryFn: async () => {
      const map: Record<string, { label: string; value: string }[]> = {};
      for (const ent of lookupEntities) {
        try {
          const results = await apiFn.get<{ label: string; value: string }[]>(`/lookups/${ent}?limit=200`);
          map[ent] = results;
        } catch {
          map[ent] = [];
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
      defaults[field.fieldKey] = field.defaultValue ?? '';
    }
    return defaults;
  }, [editableFields]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const createMutation = hooks.useCreate({
    onSuccess: (created) => {
      navigate(`/${entity.slug}/${created.id}`);
    },
  });

  function onSubmit(data: Record<string, unknown>) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== '' && val !== undefined) {
        cleaned[key] = val;
      }
    }
    createMutation.mutate(cleaned);
  }

  if (layoutLoading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted mt-2" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(`/${entity.slug}`)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Back to list"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Create {entity.singularName}</h1>
          <p className="text-sm text-muted-foreground">Fill in the details below</p>
        </div>
      </div>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-8">
          {layout?.sections.map((section) => {
            const sectionFields = section.fields.filter(
              (f) => !f.isReadonly && f.fieldType !== 'auto_number',
            );
            if (sectionFields.length === 0) return null;

            return (
              <div key={section.id} className="rounded-lg border border-border bg-card">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <h2 className="text-sm font-medium text-foreground">{section.name}</h2>
                </div>
                <div
                  className="grid gap-4 p-4"
                  style={{ gridTemplateColumns: section.columns === 1 ? '1fr' : 'repeat(2, 1fr)' }}
                >
                  {sectionFields.map((field: FullLayoutField) => (
                    <DynamicField
                      key={field.fieldKey}
                      field={field}
                      mode="edit"
                      lookupOptions={field.lookupEntity ? lookupOptionsMap?.[field.lookupEntity] : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {createMutation.isError && (
          <p className="text-sm text-destructive mt-4" aria-live="polite">
            {(createMutation.error as any)?.body?.message || `Failed to create ${entity.singularName.toLowerCase()}.`}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={() => navigate(`/${entity.slug}`)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : `Save`}
          </Button>
        </div>
      </Form>
    </div>
  );
}
