import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { createTaxonomyApi } from './services';
import type { ApiFn } from './types';

export function useEntityTags(apiFn: ApiFn, entityType: string, entityId: string) {
  const api = useMemo(() => createTaxonomyApi(apiFn), [apiFn]);
  return useQuery({
    queryKey: ['entity-tags', entityType, entityId],
    queryFn: () => api.getEntityTags(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
}

export function useSetEntityTags(
  apiFn: ApiFn,
  entityType: string,
  entityId: string,
  groupSlug: string,
) {
  const api = useMemo(() => createTaxonomyApi(apiFn), [apiFn]);
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
