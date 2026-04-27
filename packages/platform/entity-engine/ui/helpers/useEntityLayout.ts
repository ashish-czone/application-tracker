import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FullLayout, FieldDefinition } from '@packages/eav-attributes-ui';
import { useEntityEngine } from '../EntityEngineProvider';

/**
 * Fetch the layout (sections + fields) for an entity type.
 * Uses the provider's API client to call GET /layouts/{entityType}.
 *
 * Hydrates per-field `uiType` from registered EntityUIConfig.fieldUI
 * (frontend source of truth). Backend value remains as fallback until
 * PR C2 strips FieldMeta.uiType.
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
      return ui?.uiType ? { ...field, uiType: ui.uiType } : field;
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
