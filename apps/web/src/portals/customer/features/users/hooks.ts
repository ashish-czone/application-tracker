import { useQuery } from '@tanstack/react-query';
import { listUsers } from './services';
import type { ListUsersParams } from './types';

export function useUsers(params: ListUsersParams) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => listUsers(params),
  });
}
