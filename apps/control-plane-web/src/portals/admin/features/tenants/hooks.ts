import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantApi } from './services';
import type { UpdateTenantInput } from './types';

export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantApi.list(),
  });
}

export function useTenant(id: string | null) {
  return useQuery({
    queryKey: ['tenants', 'detail', id],
    queryFn: () => tenantApi.get(id!),
    enabled: !!id,
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTenantInput }) =>
      tenantApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant updated');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update tenant');
    },
  });
}
