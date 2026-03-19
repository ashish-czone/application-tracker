import { api } from '../../../../lib/api';
import type { SettingsGroup } from './types';

export function listSettings(): Promise<SettingsGroup[]> {
  return api.get<SettingsGroup[]>('/settings');
}

export function getModuleSettings(module: string): Promise<SettingsGroup> {
  return api.get<SettingsGroup>(`/settings/${module}`);
}

export function updateSetting(module: string, key: string, value: unknown): Promise<SettingsGroup> {
  return api.patch<SettingsGroup>(`/settings/${module}/${key}`, { value });
}

export function resetSetting(module: string, key: string): Promise<SettingsGroup> {
  return api.delete<SettingsGroup>(`/settings/${module}/${key}`);
}
