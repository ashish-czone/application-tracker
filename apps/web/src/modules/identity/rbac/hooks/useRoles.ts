import { useQuery } from '@tanstack/react-query';
import { getRoles, getRole } from '../api/rolesApi';

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: ['roles', id],
    queryFn: () => getRole(id),
    enabled: !!id,
  });
}
