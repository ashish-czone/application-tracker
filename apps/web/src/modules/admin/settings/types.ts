export interface SettingsFieldMetadata {
  label: string;
  description?: string;
  group?: string;
  restartRequired?: boolean;
  type: 'string' | 'number' | 'boolean' | 'duration' | 'enum';
  options?: string[];
  min?: number;
  max?: number;
}

export interface SettingsField {
  key: string;
  value: unknown;
  default: unknown;
  isOverridden: boolean;
  metadata: SettingsFieldMetadata;
}

export interface SettingsGroup {
  module: string;
  label: string;
  fields: SettingsField[];
}
