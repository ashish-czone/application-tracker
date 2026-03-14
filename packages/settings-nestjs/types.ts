import type { z } from 'zod';

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

export interface SettingsSchemaDefinition {
  module: string;
  label: string;
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  metadata: Record<string, SettingsFieldMetadata>;
}

export interface SettingsFieldResponse {
  key: string;
  value: unknown;
  default: unknown;
  isOverridden: boolean;
  metadata: SettingsFieldMetadata;
}

export interface SettingsGroupResponse {
  module: string;
  label: string;
  fields: SettingsFieldResponse[];
}

export interface SettingRecord {
  id: string;
  module: string;
  key: string;
  value: unknown;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingDelegate {
  findByModule(module: string): Promise<SettingRecord[]>;
  upsert(data: { module: string; key: string; value: unknown; updatedBy: string }): Promise<SettingRecord>;
  deleteByModuleAndKey(module: string, key: string): Promise<void>;
}

export interface SettingsModuleConfig {
  getSettingDelegate: () => SettingDelegate;
}
