import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { createUsersApi } from './services';
import type { ListUsersParams, CreateUserRequest, UpdateUserRequest, InviteUserRequest } from './types';

function useUsersApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createUsersApi(apiFn), [apiFn]);
}

export function useUsers(params: ListUsersParams, options?: { enabled?: boolean }) {
  const api = useUsersApi();
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => api.listUsers(params),
    enabled: options?.enabled,
  });
}

export function useRoles(userType?: string) {
  const api = useUsersApi();
  return useQuery({
    queryKey: ['roles', userType],
    queryFn: () => api.listRoles(userType),
  });
}

export function useCreateUser(options?: { onSuccess?: () => void }) {
  const api = useUsersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserRequest) => api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create user');
    },
  });
}

export function useUpdateUser(options?: { onSuccess?: () => void }) {
  const api = useUsersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserRequest }) => api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update user');
    },
  });
}

export function useDeleteUser(options?: { onSuccess?: () => void }) {
  const api = useUsersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deactivated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to deactivate user');
    },
  });
}

export function useResetUserPassword(options?: { onSuccess?: () => void }) {
  const api = useUsersApi();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => api.resetUserPassword(id, password),
    onSuccess: () => {
      toast.success('Password updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to reset password');
    },
  });
}

export function useRestoreUser() {
  const api = useUsersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.restoreUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User restored');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to restore user');
    },
  });
}

export function useInviteUser(options?: { onSuccess?: () => void }) {
  const api = useUsersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InviteUserRequest) => api.inviteUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Invitation sent');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to send invitation');
    },
  });
}

export function useResendInvitation(options?: { onSuccess?: () => void }) {
  const api = useUsersApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resendInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Invitation resent');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to resend invitation');
    },
  });
}
