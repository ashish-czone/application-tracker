export type SettingFieldOption = string | { value: string; label: string };

export interface SettingFieldMetadata {
  label: string;
  type: 'string' | 'number' | 'boolean' | 'password';
  description?: string;
  min?: number;
  max?: number;
  options?: SettingFieldOption[];
  hidden?: boolean;
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
