import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { createOrgUnitsApi, createOrgPositionsApi } from './services';
import type {
  CreateOrgUnitRequest,
  UpdateOrgUnitRequest,
  CreateOrgUnitLevelRequest,
  UpdateOrgUnitLevelRequest,
  AddMemberRequest,
  UpdateMemberPositionRequest,
  CreateOrgPositionRequest,
  UpdateOrgPositionRequest,
  SetPositionScopesRequest,
} from './types';

function useOrgUnitsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createOrgUnitsApi(apiFn), [apiFn]);
}

// ── Levels ────────────────────────────────────────────────────

export function useOrgUnitLevels() {
  const api = useOrgUnitsApi();
  return useQuery({
    queryKey: ['org-unit-levels'],
    queryFn: () => api.listLevels(),
  });
}

export function useCreateOrgUnitLevel(options?: { onSuccess?: () => void }) {
  const api = useOrgUnitsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrgUnitLevelRequest) => api.createLevel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-unit-levels'] });
      toast.success('Level created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create level');
    },
  });
}

export function useUpdateOrgUnitLevel(options?: { onSuccess?: () => void }) {
  const api = useOrgUnitsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrgUnitLevelRequest }) => api.updateLevel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-unit-levels'] });
      toast.success('Level updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update level');
    },
  });
}

export function useDeleteOrgUnitLevel(options?: { onSuccess?: () => void }) {
  const api = useOrgUnitsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteLevel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-unit-levels'] });
      toast.success('Level deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete level');
    },
  });
}

// ── Org Units ─────────────────────────────────────────────────

export function useOrgUnits() {
  const api = useOrgUnitsApi();
  return useQuery({
    queryKey: ['org-units'],
    queryFn: () => api.listUnits(),
  });
}

export function useCreateOrgUnit(options?: { onSuccess?: () => void }) {
  const api = useOrgUnitsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrgUnitRequest) => api.createUnit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      toast.success('Unit created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create unit');
    },
  });
}

export function useUpdateOrgUnit(options?: { onSuccess?: () => void }) {
  const api = useOrgUnitsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOrgUnitRequest }) => api.updateUnit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      toast.success('Unit updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update unit');
    },
  });
}

export function useDeleteOrgUnit(options?: { onSuccess?: () => void }) {
  const api = useOrgUnitsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      toast.success('Unit deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete unit');
    },
  });
}

// ── Members ───────────────────────────────────────────────────

export function useOrgUnitMembers(unitId: string | null) {
  const api = useOrgUnitsApi();
  return useQuery({
    queryKey: ['org-units', unitId, 'members'],
    queryFn: () => api.listMembers(unitId!),
    enabled: !!unitId,
  });
}

export function useAddOrgUnitMember(options?: { onSuccess?: () => void }) {
  const api = useOrgUnitsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, userId, data }: { unitId: string; userId: string; data?: AddMemberRequest }) =>
      api.addMember(unitId, userId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-units', variables.unitId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      toast.success('Member added');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to add member');
    },
  });
}

export function useUpdateMemberPosition(options?: { onSuccess?: () => void }) {
  const api = useOrgUnitsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, userId, data }: { unitId: string; userId: string; data: UpdateMemberPositionRequest }) =>
      api.updateMemberPosition(unitId, userId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-units', variables.unitId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      toast.success('Position updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update position');
    },
  });
}

export function useRemoveOrgUnitMember(options?: { onSuccess?: () => void }) {
  const api = useOrgUnitsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, userId }: { unitId: string; userId: string }) =>
      api.removeMember(unitId, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-units', variables.unitId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['org-units'] });
      toast.success('Member removed');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to remove member');
    },
  });
}
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
