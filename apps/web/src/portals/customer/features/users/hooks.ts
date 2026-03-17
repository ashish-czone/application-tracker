import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, listRoles, createUser } from './services';
import type { ListUsersParams, CreateUserRequest } from './types';

export function useUsers(params: ListUsersParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => listUsers(params),
  });
}

export function useRoles(userType?: string) {
  return useQuery({
    queryKey: ['roles', userType],
    queryFn: () => listRoles(userType),
  });
}

export function useCreateUser(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserRequest) => createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      options?.onSuccess?.();
    },
  });
}
