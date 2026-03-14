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
  findMany(args?: { where?: { module?: string } }): Promise<SettingRecord[]>;
  upsert(args: {
    where: { module_key: { module: string; key: string } };
    update: { value: unknown; updatedBy: string | null };
    create: { module: string; key: string; value: unknown; updatedBy: string | null };
  }): Promise<SettingRecord>;
  delete(args: {
    where: { module_key: { module: string; key: string } };
  }): Promise<SettingRecord>;
}

export interface SettingsModuleConfig {
  getSettingDelegate: () => SettingDelegate;
}
