import { useQuery } from '@tanstack/react-query';
import type { ListLayoutResponse } from '@packages/entity-engine';
import { useEntityEngine } from '../EntityEngineProvider';

/**
 * Fetch the list layout config (columns, actions, filters, sort) for an entity type.
 * Calls GET /{slug}/layout/list. Cached for 5 minutes.
 */
export function useListLayout(entityType: string) {
  const { apiFn, getEntity } = useEntityEngine();
  const entity = getEntity(entityType);
  const slug = entity?.slug;

  return useQuery({
    queryKey: ['list-layout', entityType],
    queryFn: () => apiFn.get<ListLayoutResponse>(`/${slug}/layout/list`),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}
