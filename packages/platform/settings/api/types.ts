export type SettingFieldOption = string | { value: string; label: string };

export interface SettingFieldMetadata {
  label: string;
  type: 'string' | 'number' | 'boolean' | 'password';
  description?: string;
  min?: number;
  max?: number;
  options?: SettingFieldOption[];
  /**
   * Hide from the generic settings admin UI. Use when the setting is
   * edited by a dedicated screen (e.g., agency `theme` via Appearance,
   * `companyLogo` via Branding). Still returned by `AppConfigService.get()`
   * and public endpoints — only the editable list is filtered.
   */
  hidden?: boolean;
}

export interface SettingsModuleDefinition {
  label: string;
  defaults: Record<string, unknown>;
  metadata: Record<string, SettingFieldMetadata>;
}

export interface SettingsField {
  key: string;
  value: unknown;
  default: unknown;
  isOverridden: boolean;
  metadata: SettingFieldMetadata;
}

export interface SettingsGroup {
  module: string;
  label: string;
  fields: SettingsField[];
}
