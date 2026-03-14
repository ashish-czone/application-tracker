import { useQuery } from '@tanstack/react-query';
import { getPermissions, getPermissionRegistry } from '../api/permissionsApi';

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: getPermissions,
  });
}

export function usePermissionRegistry() {
  return useQuery({
    queryKey: ['permissions', 'registry'],
    queryFn: getPermissionRegistry,
  });
}
