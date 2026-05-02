import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form, Button, ScreenLayout, toast } from '@packages/ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import {
  EntityFormFields,
  buildFormSchema,
  flattenFormFields,
  type LookupSearchFn,
} from '@packages/entity-views-ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { ORGANIZATIONS_FORM_LAYOUT } from '../../../../entity-configs/organizations.form-layout';

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

type OrganizationRow = Record<string, unknown> & { id: string };

const ORGANIZATIONS_QUERY_KEY = ['organizations'] as const;

export function OrganizationPage() {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  // Singleton — fetch the lone row via list({page:1,limit:1}). Same shape
  // as the prior useEntityHooks-driven path; just sourced directly.
  const { data: listPage, isLoading: listLoading, isError: listError } = useQuery({
    queryKey: [...ORGANIZATIONS_QUERY_KEY, 'list', { page: 1, limit: 1 }],
    queryFn: () =>
      apiFn.get<PaginatedResponse<OrganizationRow>>('/organizations?limit=1'),
  });

  const singletonId = listPage?.data?.[0]?.id;

  const { data: row, isLoading: rowLoading } = useQuery({
    queryKey: [...ORGANIZATIONS_QUERY_KEY, 'detail', singletonId],
    queryFn: () => apiFn.get<OrganizationRow>(`/organizations/${singletonId}`),
    enabled: !!singletonId,
  });

  const editableFields = useMemo(
    () => flattenFormFields(ORGANIZATIONS_FORM_LAYOUT),
    [],
  );

  const schema = useMemo(
    () => buildFormSchema(editableFields, ORGANIZATIONS_FORM_LAYOUT.entity),
    [editableFields],
  );

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiFn.patch<OrganizationRow>(`/organizations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      toast.success('Organization saved');
    },
    onError: (error: unknown) => {
      const message =
        (error as { body?: { message?: string } } | null)?.body?.message ??
        'Failed to save organization.';
      toast.error(message);
    },
  });

  // Lookup-search wrapper — routes lookup-typed field onSearch calls through
  // the shared apiFn + queryClient so de-dup + 30s short-cache apply per
  // (entity, query) pair. Org form has no lookup fields today, but the
  // primitive accepts the prop unconditionally; cheap to wire so future
  // additions don't have to retrofit.
  const lookupSearch: LookupSearchFn = (entityName, query) =>
    queryClient.fetchQuery({
      queryKey: ['org-lookup', entityName, query],
      queryFn: () =>
        apiFn.get<{ label: string; value: string }[]>(
          `/lookups/${entityName}?search=${encodeURIComponent(query)}&limit=20`,
        ),
      staleTime: 30_000,
    });

  function onSubmit(data: Record<string, unknown>) {
    if (!singletonId) return;
    // Drop empty strings + undefined so the partial-update DTO doesn't
    // overwrite existing values with blanks. Mirrors the behaviour the
    // prior `buildEntityPayload` provided for non-nested fields; the org
    // entity has no `nestedPath` fields so the simpler inline filter is
    // sufficient.
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === '' || value === undefined) continue;
      payload[key] = value;
    }
    updateMutation.mutate({ id: singletonId, data: payload });
  }

  const isLoading = listLoading || rowLoading;

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
            <EntityFormFields
              layout={ORGANIZATIONS_FORM_LAYOUT}
              lookupSearch={lookupSearch}
            />

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
