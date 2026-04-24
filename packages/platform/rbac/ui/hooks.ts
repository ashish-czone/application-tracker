import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { createRbacApi } from './services';
import type {
  ListRolesParams,
  ListRoleMembersParams,
  CreateRoleRequest,
  UpdateRoleRequest,
  PermissionEntry,
} from './types';

function useRbacApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createRbacApi(apiFn), [apiFn]);
}

export function useRolesList(params: ListRolesParams) {
  const api = useRbacApi();
  return useQuery({
    queryKey: ['roles', params],
    queryFn: () => api.listRoles(params),
  });
}

export function useCreateRole(options?: { onSuccess?: () => void }) {
  const api = useRbacApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoleRequest) => api.createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create role');
    },
  });
}

export function useUpdateRole(options?: { onSuccess?: () => void }) {
  const api = useRbacApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRoleRequest }) => api.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update role');
    },
  });
}

export function useDeleteRole(options?: { onSuccess?: () => void }) {
  const api = useRbacApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete role');
    },
  });
}

export function useRolePermissions(roleId: string | null) {
  const api = useRbacApi();
  return useQuery({
    queryKey: ['roles', roleId, 'permissions'],
    queryFn: () => api.getRolePermissions(roleId!),
    enabled: !!roleId,
  });
}

export function useSetRolePermissions(options?: { onSuccess?: () => void }) {
  const api = useRbacApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: PermissionEntry[] }) =>
      api.setRolePermissions(roleId, permissions),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roles', variables.roleId, 'permissions'] });
      toast.success('Permissions updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update permissions');
    },
  });
}

export function usePermissionManifests() {
  const api = useRbacApi();
  return useQuery({
    queryKey: ['permission-manifests'],
    queryFn: () => api.listPermissionManifests(),
    staleTime: Infinity,
  });
}

export function useRoleMembers(roleId: string | null, params: ListRoleMembersParams = {}) {
  const api = useRbacApi();
  return useQuery({
    queryKey: ['roles', roleId, 'members', params],
    queryFn: () => api.listRoleMembers(roleId!, params),
    enabled: !!roleId,
  });
}

export function useAddRoleMember(options?: { onSuccess?: () => void }) {
  const api = useRbacApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.addRoleMember(roleId, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roles', variables.roleId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Member added');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to add member');
    },
  });
}

export function useRemoveRoleMember(options?: { onSuccess?: () => void }) {
  const api = useRbacApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, userId }: { roleId: string; userId: string }) =>
      api.removeRoleMember(roleId, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roles', variables.roleId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Member removed');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to remove member');
    },
  });
}
