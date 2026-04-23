import { Injectable, NotFoundException } from '@nestjs/common';
import { SettingsStoreService } from './settings-store.service';
import type { SettingsModuleDefinition, SettingsGroup, SettingsField } from '../types';

@Injectable()
export class AppConfigService {
  private readonly registry = new Map<string, SettingsModuleDefinition>();

  constructor(private readonly store: SettingsStoreService) {}

  register(module: string, definition: SettingsModuleDefinition) {
    this.registry.set(module, definition);
  }

  get<T = unknown>(module: string, key: string, defaultValue?: T): T {
    // Check DB override first
    const cached = this.store.getCached(module, key);
    if (cached !== undefined) return cached as T;

    // Fall back to registered default
    const definition = this.registry.get(module);
    if (definition && key in definition.defaults) {
      return definition.defaults[key] as T;
    }

    // Fall back to inline default
    if (defaultValue !== undefined) return defaultValue;

    throw new NotFoundException(`Config key '${key}' not found in module '${module}'`);
  }

  async set(module: string, key: string, value: unknown, updatedBy: string) {
    const definition = this.registry.get(module);
    if (!definition) {
      throw new NotFoundException(`Module '${module}' is not registered`);
    }
    if (!(key in definition.defaults)) {
      throw new NotFoundException(`Key '${key}' is not a valid config key for module '${module}'`);
    }

    await this.store.upsert(module, key, value, updatedBy);
  }

  async reset(module: string, key: string) {
    const definition = this.registry.get(module);
    if (!definition) {
      throw new NotFoundException(`Module '${module}' is not registered`);
    }

    await this.store.remove(module, key);
  }

  getAll(): SettingsGroup[] {
    const groups: SettingsGroup[] = [];

    for (const [module, definition] of this.registry) {
      groups.push(this.buildGroup(module, definition));
    }

    return groups;
  }

  getByModule(module: string): SettingsGroup {
    const definition = this.registry.get(module);
    if (!definition) {
      throw new NotFoundException(`Module '${module}' is not registered`);
    }

    return this.buildGroup(module, definition);
  }

  has(module: string): boolean {
    return this.registry.has(module);
  }

  private buildGroup(module: string, definition: SettingsModuleDefinition): SettingsGroup {
    const overrides = this.store.getAllCachedByModule(module);

    const fields: SettingsField[] = Object.entries(definition.defaults)
      .filter(([key]) => !definition.metadata[key]?.hidden)
      .map(([key, defaultValue]) => {
        const isOverridden = key in overrides;
        return {
          key,
          value: isOverridden ? overrides[key] : defaultValue,
          default: defaultValue,
          isOverridden,
          metadata: definition.metadata[key] ?? { label: key, type: 'string' },
        };
      });

    return {
      module,
      label: definition.label,
      fields,
    };
  }
}
