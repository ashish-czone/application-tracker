import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FullLayout, FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityEngine } from '../EntityEngineProvider';

/**
 * Fetch the layout (sections + fields) for an entity type.
 * Uses the provider's API client to call GET /layouts/{entityType}.
 *
 * Per field, the FE-side `fieldUI` overrides `label` and `uiType` (the FE is
 * the source of truth — Strip B-4 will drop these from the api wire for
 * code-defined entities; admin-configurable entities continue to source
 * them from DB-backed `field_definitions` rows).
 */
export function useEntityLayout(entityType: string) {
  const { apiFn, getFieldUI } = useEntityEngine();

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
    return {
      ...query.data,
      sections: query.data.sections.map((section) => ({
        ...section,
        fields: section.fields.map(enrichField),
      })),
      quickCreateFields: query.data.quickCreateFields.map(enrichField),
    };
  }, [query.data, entityType, getFieldUI]);

  return { ...query, data: hydrated };
}
