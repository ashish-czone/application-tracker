import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ListLayoutResponse, EntityAction, ListLayoutColumn } from '@packages/entity-engine';
import { useEntityEngine } from '../EntityEngineProvider';

/**
 * Fetch the list layout config (columns, actions, filters, sort) for an entity type.
 * Calls GET /{slug}/layout/list. Cached for 5 minutes.
 *
 * Hydrates per-column presentation and per-action overrides from registered
 * EntityUIConfigs (frontend source of truth). Backend values remain as
 * fallback until Strip B-4 strips them api-side.
 *
 * Per column, FE-side `fieldUI` overrides `label` / `cellRenderer` and the
 * registered `listColumns` config overrides `visible` / `order` (with
 * fields excluded via `listColumnHidden` filtered out entirely). When no FE
 * config is registered for an entity, the api response passes through as
 * before.
 */
export function useListLayout(entityType: string) {
  const { apiFn, getEntity, getFieldUI, getActionUI, getListColumns } = useEntityEngine();
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
    const listColumnsConfig = getListColumns(entityType);
    const listColumnsByKey = listColumnsConfig
      ? new Map(listColumnsConfig.map((c) => [c.fieldKey, c]))
      : null;

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

    const enrichColumn = (col: ListLayoutColumn): ListLayoutColumn | null => {
      const fieldUI = getFieldUI(entityType, col.fieldKey);
      if (fieldUI?.listColumnHidden) return null;
      const listOverride = listColumnsByKey?.get(col.fieldKey);
      const next: ListLayoutColumn = { ...col };
      if (fieldUI?.label) next.label = fieldUI.label;
      if (fieldUI?.cellRenderer) next.cellRenderer = fieldUI.cellRenderer;
      if (listOverride?.visible !== undefined) next.visible = listOverride.visible;
      if (listOverride?.order !== undefined) next.order = listOverride.order;
      return next;
    };

    const enrichedColumns = query.data.columns
      .map(enrichColumn)
      .filter((c): c is ListLayoutColumn => c !== null);

    // If FE list-columns config is registered, re-sort by overridden order.
    if (listColumnsByKey) {
      enrichedColumns.sort((a, b) => a.order - b.order);
    }

    return {
      ...query.data,
      columns: enrichedColumns,
      actions: {
        row: query.data.actions.row.map(enrichAction),
        bulk: query.data.actions.bulk.map(enrichAction),
        detail: (query.data.actions.detail ?? []).map(enrichAction),
      },
    };
  }, [query.data, entityType, getFieldUI, getActionUI, getListColumns]);

  return { ...query, data: hydrated };
}
