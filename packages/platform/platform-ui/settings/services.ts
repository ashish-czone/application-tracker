import type { ApiFn } from '../PlatformUIProvider';
import type { SettingsGroup } from './types';

export function createSettingsApi(api: ApiFn) {
  return {
    listSettings(): Promise<SettingsGroup[]> {
      return api.get<SettingsGroup[]>('/settings');
    },
    getModuleSettings(module: string): Promise<SettingsGroup> {
      return api.get<SettingsGroup>(`/settings/${module}`);
    },
    updateSetting(module: string, key: string, value: unknown): Promise<SettingsGroup> {
      return api.patch<SettingsGroup>(`/settings/${module}/${key}`, { value });
    },
    resetSetting(module: string, key: string): Promise<SettingsGroup> {
      return api.delete<SettingsGroup>(`/settings/${module}/${key}`);
    },
  };
}

export type SettingsApi = ReturnType<typeof createSettingsApi>;
