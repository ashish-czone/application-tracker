import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ListLayoutResponse, EntityAction } from '@packages/entity-engine';
import { useEntityEngine } from '../EntityEngineProvider';

/**
 * Fetch the list layout config (columns, actions, filters, sort) for an entity type.
 * Calls GET /{slug}/layout/list. Cached for 5 minutes.
 *
 * Hydrates per-column `cellRenderer` and per-action `label`/`icon`/`variant`
 * from registered EntityUIConfigs (frontend source of truth). Backend values
 * are kept as fallback until PR C2 strips them backend-side.
 */
export function useListLayout(entityType: string) {
  const { apiFn, getEntity, getFieldUI, getActionUI } = useEntityEngine();
  const entity = getEntity(entityType);
  const slug = entity?.slug;

  const query = useQuery({
    queryKey: ['list-layout', entityType],
    queryFn: () => apiFn.get<ListLayoutResponse>(`/${slug}/layout/list`),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  const hydrated = useMemo<ListLayoutResponse | undefined>(() => {
    if (!query.data) return undefined;
    const enrichAction = (a: EntityAction): EntityAction => {
      const ui = getActionUI(entityType, a.key);
      if (!ui) return a;
      return {
        ...a,
        label: ui.label ?? a.label,
        icon: ui.icon ?? a.icon,
        variant: ui.variant ?? a.variant,
      };
    };
    return {
      ...query.data,
      columns: query.data.columns.map((col) => {
        const fieldUI = getFieldUI(entityType, col.fieldKey);
        return fieldUI?.cellRenderer ? { ...col, cellRenderer: fieldUI.cellRenderer } : col;
      }),
      actions: {
        row: query.data.actions.row.map(enrichAction),
        bulk: query.data.actions.bulk.map(enrichAction),
        detail: (query.data.actions.detail ?? []).map(enrichAction),
      },
    };
  }, [query.data, entityType, getFieldUI, getActionUI]);

  return { ...query, data: hydrated };
}
