import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Button, ScreenLayout, toast } from '@packages/ui';
import {
  DynamicField,
  buildFormSchema,
  buildEntityPayload,
  type FieldDefinition,
} from '@packages/eav-attributes-ui';
import { useEntityHooks, useEntityLayout } from '@packages/entity-engine-ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

const ENTITY_TYPE = 'organization';

export function OrganizationPage() {
  const orgHooks = useEntityHooks(ENTITY_TYPE);
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(ENTITY_TYPE);
  const { data: listPage, isLoading: listLoading, isError: listError } = orgHooks.useList({
    page: 1,
    limit: 1,
  });

  const singletonId = listPage?.data?.[0]?.id as string | undefined;

  const { data: row, isLoading: rowLoading } = orgHooks.useDetail(singletonId);

  const sections = useMemo(() => {
    if (!layout) return [];
    return layout.sections
      .filter((s) => s.id !== '__unassigned__')
      .map((s) => ({
        ...s,
        editableFields: s.fields.filter(
          (f) => !f.isReadonly && f.fieldType !== 'auto_number',
        ),
      }))
      .filter((s) => s.editableFields.length > 0);
  }, [layout]);

  const editableFields = useMemo(
    () => sections.flatMap((s) => s.editableFields),
    [sections],
  );

  const schema = useMemo(() => buildFormSchema(editableFields), [editableFields]);

  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of editableFields) {
      const raw = row?.[field.fieldKey];
      defaults[field.fieldKey] = raw ?? field.defaultValue ?? '';
    }
    return defaults;
  }, [editableFields, row]);

  const form = useForm({ resolver: zodResolver(schema), defaultValues });

  useEffect(() => {
    if (row) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  const updateMutation = orgHooks.useUpdate({
    onSuccess: () => toast.success('Organization saved'),
  });

  function onSubmit(data: Record<string, unknown>) {
    if (!layout || !singletonId) return;
    const payload = buildEntityPayload(data, layout);
    updateMutation.mutate({ id: singletonId, data: payload });
  }

  const isLoading = layoutLoading || listLoading || rowLoading;

  return (
    <ScreenLayout
      topBar={<ScreenPreviewTopBar active="dashboard" />}
      breadcrumb={['Workspace', 'Organization']}
      title="Organization"
      subtitle="Your organization's identity, contact details, and address. Used across documents, exports, and notifications."
    >
      <div className="border border-rule bg-paper-raised p-8">
        {isLoading ? (
          <OrganizationSkeleton />
        ) : listError || !singletonId ? (
          <OrganizationLoadError />
        ) : (
          <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-8">
              {sections.map((section) => (
                <OrganizationSection key={section.id} name={section.name} fields={section.editableFields} />
              ))}
            </div>

            {updateMutation.isError && (
              <p className="mt-4 text-sm text-destructive" aria-live="polite">
                {(updateMutation.error as { body?: { message?: string } } | null)?.body?.message ||
                  'Failed to save organization.'}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-rule pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset(defaultValues)}
                disabled={updateMutation.isPending || !form.formState.isDirty}
              >
                Discard
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !form.formState.isDirty}>
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </Form>
        )}
      </div>
    </ScreenLayout>
  );
}

function OrganizationSection({ name, fields }: { name: string; fields: FieldDefinition[] }) {
  return (
    <div className="rounded-md border border-rule bg-paper">
      <div className="border-b border-rule bg-paper-raised/30 px-4 py-3">
        <h2 className="text-sm font-medium text-ink">{name}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
        {fields.map((field) => (
          <DynamicField key={field.fieldKey} field={field} mode="edit" />
        ))}
      </div>
    </div>
  );
}

function OrganizationSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded bg-muted" />
      ))}
    </div>
  );
}

function OrganizationLoadError() {
  return (
    <div className="text-sm text-ink-soft">
      Could not load the organization record. Try refreshing the page.
    </div>
  );
}
