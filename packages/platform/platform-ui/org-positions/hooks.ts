import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '../PlatformUIProvider';
import { createOrgPositionsApi } from './services';
import type { CreateOrgPositionRequest, UpdateOrgPositionRequest, SetPositionScopesRequest } from './types';

function useOrgPositionsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createOrgPositionsApi(apiFn), [apiFn]);
}

export function useOrgPositions() {
  const api = useOrgPositionsApi();
  return useQuery({
    queryKey: ['org-positions'],
    queryFn: () => api.list(),
  });
}

export function useCreateOrgPosition(options?: { onSuccess?: () => void }) {
  const api = useOrgPositionsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrgPositionRequest) => api.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-positions'] });
      toast.success('Position created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create position');
    },
  });
}

export function useUpdateOrgPosition(options?: { onSuccess?: () => void }) {
  const api = useOrgPositionsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrgPositionRequest }) => api.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-positions'] });
      toast.success('Position updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update position');
    },
  });
}

export function useDeleteOrgPosition(options?: { onSuccess?: () => void }) {
  const api = useOrgPositionsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-positions'] });
      toast.success('Position deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete position');
    },
  });
}

export function usePositionScopes(positionId: string | null) {
  const api = useOrgPositionsApi();
  return useQuery({
    queryKey: ['org-positions', positionId, 'scopes'],
    queryFn: () => api.getScopes(positionId!),
    enabled: !!positionId,
  });
}

export function useSetPositionScopes(options?: { onSuccess?: () => void }) {
  const api = useOrgPositionsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ positionId, data }: { positionId: string; data: SetPositionScopesRequest }) =>
      api.setScopes(positionId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-positions', variables.positionId, 'scopes'] });
      toast.success('Scopes updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update scopes');
    },
  });
}
