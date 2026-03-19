import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { listSettings, updateSetting, resetSetting } from './services';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => listSettings(),
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ module, key, value }: { module: string; key: string; value: unknown }) =>
      updateSetting(module, key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Setting updated');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update setting');
    },
  });
}

export function useResetSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ module, key }: { module: string; key: string }) =>
      resetSetting(module, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Setting reset to default');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to reset setting');
    },
  });
}
