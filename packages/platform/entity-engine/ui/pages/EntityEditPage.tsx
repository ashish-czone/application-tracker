import { useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Form, Button } from '@packages/ui';
import { DynamicField, buildFormSchema, buildEntityPayload } from '@packages/eav-attributes-ui';
import type { FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';

interface EntityEditPageProps {
  entityType: string;
}

/**
 * Full-page edit form for an entity. Mirrors `EntityCreatePage` for layout,
 * section rendering, and relationship handling, with three differences:
 * - Loads the row via `hooks.useDetail(id)` and seeds form defaults from it.
 * - For collection relationships, flattens the `[{id,label,...}]` array the
 *   read path returns into the `[id, ...]` shape the chip input expects, and
 *   passes the original `{label,value}` pairs as `chipOptions` so the chips
 *   render with labels on first paint.
 * - Submits via PATCH (`hooks.useUpdate`); `buildEntityPayload` reshapes
 *   nested + relation keys the same way as create. Empty fields drop out,
 *   so unchanged hasOne writes (e.g. password) are not sent.
 *
 * Edit is always single-page (no wizard), regardless of `entity.ui.createMode`.
 */
export function EntityEditPage({ entityType }: EntityEditPageProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { apiFn } = useEntityEngine();
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(entityType);
  const { data: row, isLoading: rowLoading } = hooks.useDetail(id);

  // Synthesize a FieldDefinition per collection relationship — same as
  // EntityCreatePage, so the form registers a flat `[id,...]` array under
  // the relation name.
  const relationFields = useMemo<FieldDefinition[]>(() => {
    if (!layout) return [];
    return layout.relationSections.map((rel): FieldDefinition => ({
      id: `__rel_${rel.name}__`,
      entityType,
      fieldKey: rel.name,
      label: rel.label,
      fieldType: 'multi_lookup',
      uiType: null,
      isRequired: false,
      isSystem: false,
      isCustom: false,
      isUnique: false,
      isQuickCreate: false,
      isReadonly: false,
      maxLength: null,
      defaultValue: null,
      columnName: null,
      lookupEntity: rel.targetEntity,
      lookupLabelField: null,
      lookupSearchFields: null,
      tagGroupSlug: null,
      categoryGroupSlug: null,
      fileAccept: null,
      fileMaxSize: null,
      sortOrder: rel.sortOrder,
      picklistOptions: [],
      columnIndex: 0,
      nestedPath: null,
    }));
  }, [layout, entityType]);

  const sections = useMemo(() => {
    if (!layout) return [];
    const base = layout.sections
      .filter((s) => s.id !== '__unassigned__')
      .map((s) => ({
        ...s,
        editableFields: s.fields.filter((f) => !f.isReadonly && f.fieldType !== 'auto_number'),
      }))
      .filter((s) => s.editableFields.length > 0);

    if (relationFields.length > 0) {
      base.push({
        id: '__relations__',
        name: 'Associations',
        columns: 1,
        sortOrder: 10_000,
        isCollapsible: false,
        isTabular: false,
        tabularMaxRows: null,
        fields: relationFields,
        editableFields: relationFields,
      });
    }
    return base;
  }, [layout, relationFields]);

  const editableFields = useMemo(() => sections.flatMap((s) => s.editableFields), [sections]);

  const searchUsers = useCallback(async (query: string) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(`/users?search=${encodeURIComponent(query)}&limit=20&sort=firstName&order=asc`);
    return res.data.map((u) => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }));
  }, [apiFn]);

  const searchLookup = useCallback(async (entityName: string, query: string) => {
    return apiFn.get<{ label: string; value: string }[]>(`/lookups/${entityName}?search=${encodeURIComponent(query)}&limit=20`);
  }, [apiFn]);

  const searchTags = useCallback(async (groupSlug: string, query: string) => {
    return apiFn.get<{ label: string; value: string; color?: string }[]>(
      `/tags/group/${groupSlug}?search=${encodeURIComponent(query)}&limit=20`,
    );
  }, [apiFn]);

  const schema = useMemo(() => buildFormSchema(editableFields), [editableFields]);

  // Build initial form values from the fetched row. Relation values arrive
  // as `[{id, name, ...}]`; flatten to `[id, ...]` for the chip input.
  const defaultValues = useMemo(() => {
    const defaults: Record<string, unknown> = {};
    for (const field of editableFields) {
      if (
        field.fieldType === 'multi_lookup' ||
        field.fieldType === 'multi_user' ||
        field.fieldType === 'multi_select' ||
        field.fieldType === 'tags'
      ) {
        const raw = row?.[field.fieldKey];
        if (Array.isArray(raw)) {
          defaults[field.fieldKey] = raw.map((v) =>
            typeof v === 'object' && v !== null && 'id' in v ? (v as { id: string }).id : v,
          );
        } else {
          defaults[field.fieldKey] = [];
        }
      } else {
        const raw = row?.[field.fieldKey];
        defaults[field.fieldKey] = raw ?? field.defaultValue ?? '';
      }
    }
    return defaults;
  }, [editableFields, row]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // Reset form when row finishes loading (defaultValues is stale until then).
  useEffect(() => {
    if (row) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row]);

  // For relation fields, derive the chipOptions from the fetched row so the
  // chip input renders with labels on first paint (not just ids).
  const chipOptionsByField = useMemo(() => {
    const map = new Map<string, { label: string; value: string }[]>();
    for (const field of relationFields) {
      const raw = row?.[field.fieldKey];
      if (!Array.isArray(raw)) continue;
      const options = raw
        .map((v) => {
          if (typeof v !== 'object' || v === null) return null;
          const r = v as Record<string, unknown>;
          const id = typeof r.id === 'string' ? r.id : null;
          if (!id) return null;
          const label =
            (typeof r.name === 'string' && r.name) ||
            (typeof r.label === 'string' && r.label) ||
            id;
          return { label, value: id };
        })
        .filter((o): o is { label: string; value: string } => o !== null);
      map.set(field.fieldKey, options);
    }
    return map;
  }, [row, relationFields]);

  const updateMutation = hooks.useUpdate({
    onSuccess: () => {
      navigate(`/${entity.slug}/${id}`);
    },
  });

  function onSubmit(data: Record<string, unknown>) {
    if (!layout || !id) return;
    const payload = buildEntityPayload(data, layout);
    updateMutation.mutate({ id, data: payload });
  }

  if (layoutLoading || rowLoading) {
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

  function renderSection(section: typeof sections[number]) {
    return (
      <div key={section.id} className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-medium text-foreground">{section.name}</h2>
        </div>
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: section.columns === 1 ? '1fr' : 'repeat(2, 1fr)' }}
        >
          {section.editableFields.map((field: FieldDefinition) => (
            <DynamicField
              key={field.fieldKey}
              field={field}
              mode="edit"
              chipOptions={chipOptionsByField.get(field.fieldKey)}
              onSearch={
                field.fieldType === 'user' ? searchUsers
                : field.fieldType === 'lookup' && field.lookupEntity ? (q: string) => searchLookup(field.lookupEntity!, q)
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
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(`/${entity.slug}/${id}`)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Back to detail"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Edit {entity.singularName}</h1>
          <p className="text-sm text-muted-foreground">Update details below</p>
        </div>
      </div>

      <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-8">
          {sections.map((s) => renderSection(s))}
        </div>

        {updateMutation.isError && (
          <p className="text-sm text-destructive mt-4" aria-live="polite">
            {(updateMutation.error as any)?.body?.message || `Failed to update ${entity.singularName.toLowerCase()}.`}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/${entity.slug}/${id}`)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </Form>
    </div>
  );
}
