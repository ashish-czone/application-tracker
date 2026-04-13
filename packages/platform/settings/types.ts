export interface SettingFieldMetadata {
  label: string;
  type: 'string' | 'number' | 'boolean' | 'password';
  description?: string;
  min?: number;
  max?: number;
  options?: string[];
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
