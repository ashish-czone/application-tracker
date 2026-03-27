export interface SettingFieldMetadata {
  label: string;
  type: 'string' | 'number' | 'boolean';
  description?: string;
  min?: number;
  max?: number;
  options?: string[];
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
