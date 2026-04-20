import { useQuery } from '@tanstack/react-query';
import { useEntityEngine } from '../EntityEngineProvider';

/**
 * Returns a map of `categoryGroupSlug -> count of field definitions referencing it`.
 * Backed by GET /fields/usage/category-groups. Slugs with zero references are
 * absent from the map; callers should default to 0.
 */
export function useCategoryGroupUsage() {
  const { apiFn } = useEntityEngine();

  return useQuery({
    queryKey: ['field-usage', 'category-groups'],
    queryFn: () => apiFn.get<Record<string, number>>('/fields/usage/category-groups'),
    staleTime: 60 * 1000,
  });
}
