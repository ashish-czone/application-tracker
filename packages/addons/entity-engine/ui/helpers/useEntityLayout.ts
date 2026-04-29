import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FullLayout, FieldDefinition, LayoutSection } from '@packages/eav-attributes-ui';
import { useEntityEngine } from '../EntityEngineProvider';
import type { SyntheticFieldSpec } from '../types';

/**
 * Fetch the layout (sections + fields) for an entity type.
 * Uses the provider's API client to call GET /layouts/{entityType}.
 *
 * Per field, the FE-side `fieldUI` overrides `label` and `uiType` (the FE is
 * the source of truth — Strip B-4 will drop these from the api wire for
 * code-defined entities; admin-configurable entities continue to source
 * them from DB-backed `field_definitions` rows).
 *
 * Synthetic fields declared in `EntityUIConfig.formLayout.syntheticFields`
 * are merged into the matching api section by name. They render alongside
 * api-backed fields but their values are routed by the entity's domain
 * service on save (the api never persists them directly).
 */
export function useEntityLayout(entityType: string) {
  const { apiFn, getFieldUI, getFormLayout } = useEntityEngine();

  const query = useQuery({
    queryKey: ['layout', entityType],
    queryFn: () => apiFn.get<FullLayout>(`/layouts/${entityType}`),
    enabled: !!entityType,
    staleTime: 2 * 60 * 1000,
  });

  const hydrated = useMemo<FullLayout | undefined>(() => {
    if (!query.data) return undefined;
    const enrichField = (field: FieldDefinition): FieldDefinition => {
      const ui = getFieldUI(entityType, field.fieldKey);
      if (!ui) return field;
      const next: FieldDefinition = { ...field };
      if (ui.label) next.label = ui.label;
      if (ui.uiType) next.uiType = ui.uiType;
      return next;
    };

    const formLayout = getFormLayout(entityType);
    const synthetics = formLayout?.syntheticFields ?? [];
    const syntheticsBySection = new Map<string, SyntheticFieldSpec[]>();
    for (const s of synthetics) {
      const list = syntheticsBySection.get(s.section) ?? [];
      list.push(s);
      syntheticsBySection.set(s.section, list);
    }

    const mergeSyntheticsIntoSection = (section: LayoutSection): LayoutSection => {
      const extras = syntheticsBySection.get(section.name) ?? [];
      if (extras.length === 0) {
        return { ...section, fields: section.fields.map(enrichField) };
      }
      const apiFields = section.fields.map(enrichField);
      const apiKeys = new Set(apiFields.map((f) => f.fieldKey));
      const syntheticFields = extras
        .filter((s) => !apiKeys.has(s.fieldKey))
        .map((s, idx) => syntheticToFieldDefinition(s, entityType, apiFields.length + idx));
      return { ...section, fields: [...apiFields, ...syntheticFields] };
    };

    return {
      ...query.data,
      sections: query.data.sections.map(mergeSyntheticsIntoSection),
      quickCreateFields: query.data.quickCreateFields.map(enrichField),
    };
  }, [query.data, entityType, getFieldUI, getFormLayout]);

  return { ...query, data: hydrated };
}

/**
 * Materialize a SyntheticFieldSpec into a full FieldDefinition the form
 * pipeline can consume. Required-by-type fields the spec doesn't carry are
 * filled with no-op defaults.
 *
 * Exported for testing.
 */
export function syntheticToFieldDefinition(
  spec: SyntheticFieldSpec,
  entityType: string,
  sortOrder: number,
): FieldDefinition {
  return {
    id: `synthetic:${entityType}:${spec.fieldKey}`,
    entityType,
    fieldKey: spec.fieldKey,
    label: spec.label,
    fieldType: spec.fieldType,
    uiType: spec.uiType ?? null,
    isRequired: spec.isRequired ?? false,
    isSystem: false,
    isCustom: false,
    isUnique: false,
    isQuickCreate: spec.isQuickCreate ?? false,
    isReadonly: spec.isReadonly ?? false,
    maxLength: spec.maxLength ?? null,
    defaultValue: spec.defaultValue ?? null,
    columnName: null,
    lookupEntity: spec.lookupEntity ?? null,
    lookupLabelField: null,
    lookupSearchFields: null,
    tagGroupSlug: spec.tagGroupSlug ?? null,
    categoryGroupSlug: spec.categoryGroupSlug ?? null,
    fileAccept: null,
    fileMaxSize: null,
    sortOrder,
    picklistOptions: (spec.picklistOptions ?? []).map((o, i) => ({
      id: `synthetic:${entityType}:${spec.fieldKey}:${o.value}`,
      fieldId: `synthetic:${entityType}:${spec.fieldKey}`,
      label: o.label,
      value: o.value,
      isDefault: o.isDefault ?? false,
      sortOrder: i,
    })),
    columnIndex: 0,
    nestedPath: null,
  };
}
