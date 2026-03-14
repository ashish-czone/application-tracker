import { api } from '../../../../lib/api';
import type { SettingsGroup } from '../types';

export function getSettings(): Promise<SettingsGroup[]> {
  return api.get<SettingsGroup[]>('/settings');
}

export function getModuleSettings(module: string): Promise<SettingsGroup> {
  return api.get<SettingsGroup>(`/settings/${module}`);
}

export function updateModuleSettings(
  module: string,
  settings: Array<{ key: string; value: unknown }>,
): Promise<SettingsGroup> {
  return api.patch<SettingsGroup>(`/settings/${module}`, { settings });
}

export function resetSetting(module: string, key: string): Promise<SettingsGroup> {
  return api.delete<SettingsGroup>(`/settings/${module}/${key}`);
}
