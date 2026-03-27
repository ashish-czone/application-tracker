import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '../PlatformUIProvider';
import { createSettingsApi } from './services';

function useSettingsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createSettingsApi(apiFn), [apiFn]);
}

export function useSettings() {
  const api = useSettingsApi();
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.listSettings(),
  });
}

export function useUpdateSetting() {
  const api = useSettingsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ module, key, value }: { module: string; key: string; value: unknown }) =>
      api.updateSetting(module, key, value),
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
  const api = useSettingsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ module, key }: { module: string; key: string }) =>
      api.resetSetting(module, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Setting reset to default');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to reset setting');
    },
  });
}
