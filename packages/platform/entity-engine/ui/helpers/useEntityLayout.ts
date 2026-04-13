import { useQuery } from '@tanstack/react-query';
import type { FullLayout } from '@packages/eav-attributes-ui';
import { useEntityEngine } from '../EntityEngineProvider';

/**
 * Fetch the layout (sections + fields) for an entity type.
 * Uses the provider's API client to call GET /layouts/{entityType}.
 */
export function useEntityLayout(entityType: string) {
  const { apiFn } = useEntityEngine();

  return useQuery({
    queryKey: ['layout', entityType],
    queryFn: () => apiFn.get<FullLayout>(`/layouts/${entityType}`),
    enabled: !!entityType,
    staleTime: 2 * 60 * 1000,
  });
}
