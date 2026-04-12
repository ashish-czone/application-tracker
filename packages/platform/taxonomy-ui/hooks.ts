import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui/PlatformUIProvider';
import { createTaxonomyApi } from './services';

function useTaxonomyApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createTaxonomyApi(apiFn), [apiFn]);
}

export function useEntityTags(entityType: string, entityId: string) {
  const api = useTaxonomyApi();
  return useQuery({
    queryKey: ['entity-tags', entityType, entityId],
    queryFn: () => api.getEntityTags(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useSetEntityTags(entityType: string, entityId: string, groupSlug: string) {
  const api = useTaxonomyApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagIds: string[]) => api.setEntityTags(entityType, entityId, groupSlug, tagIds),
    onSuccess: (data) => {
      queryClient.setQueryData(['entity-tags', entityType, entityId], data);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update tags');
    },
  });
}
