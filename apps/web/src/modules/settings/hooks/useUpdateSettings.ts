import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateModuleSettings, resetSetting } from '../api/settingsApi';

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ module, settings }: { module: string; settings: Array<{ key: string; value: unknown }> }) =>
      updateModuleSettings(module, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
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
    },
  });
}
