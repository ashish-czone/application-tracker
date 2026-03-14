import { Injectable } from '@nestjs/common';
import type { SettingsSchemaDefinition } from '../types';

@Injectable()
export class SettingsRegistryService {
  private registry = new Map<string, SettingsSchemaDefinition>();

  register(definition: SettingsSchemaDefinition) {
    if (this.registry.has(definition.module)) {
      throw new Error(
        `Settings schema for module "${definition.module}" is already registered`,
      );
    }

    const schemaKeys = Object.keys(definition.schema.shape);
    const metadataKeys = Object.keys(definition.metadata);

    for (const key of schemaKeys) {
      if (!metadataKeys.includes(key)) {
        throw new Error(
          `Settings schema for module "${definition.module}" is missing metadata for key "${key}"`,
        );
      }
    }

    for (const key of metadataKeys) {
      if (!schemaKeys.includes(key)) {
        throw new Error(
          `Settings metadata for module "${definition.module}" has unknown key "${key}" not in schema`,
        );
      }
    }

    this.registry.set(definition.module, definition);
  }

  getAll(): SettingsSchemaDefinition[] {
    return Array.from(this.registry.values()).sort((a, b) =>
      a.module.localeCompare(b.module),
    );
  }

  getByModule(module: string): SettingsSchemaDefinition | undefined {
    return this.registry.get(module);
  }

  has(module: string): boolean {
    return this.registry.has(module);
  }
}
