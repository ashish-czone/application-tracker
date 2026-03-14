import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRolePermissions, setRolePermissions } from '../api/rolesApi';

export function useRolePermissions(roleId: string) {
  return useQuery({
    queryKey: ['roles', roleId, 'permissions'],
    queryFn: () => getRolePermissions(roleId),
    enabled: !!roleId,
  });
}

export function useSetRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      setRolePermissions(roleId, permissionIds),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roles', variables.roleId, 'permissions'] });
    },
  });
}
