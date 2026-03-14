import { Inject, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SETTINGS_MODULE_CONFIG } from '../constants';
import { SETTINGS_SETTING_UPDATED } from '../events/types';
import { SettingsRegistryService } from './settings-registry.service';
import type {
  SettingsModuleConfig,
  SettingsGroupResponse,
  SettingsFieldResponse,
  SettingRecord,
} from '../types';
import type { SettingUpdatedEvent } from '../events/types';

interface CacheEntry {
  data: Map<string, unknown>;
  loadedAt: number;
}

const CACHE_TTL_MS = 60_000;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(SETTINGS_MODULE_CONFIG) private readonly config: SettingsModuleConfig,
    private readonly registry: SettingsRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async get<T = unknown>(module: string, key: string, defaultValue: T): Promise<T> {
    const moduleCache = await this.loadModuleCache(module);
    if (moduleCache.has(key)) {
      return moduleCache.get(key) as T;
    }
    return defaultValue;
  }

  async getModuleSettings(module: string): Promise<SettingsGroupResponse> {
    const definition = this.registry.getByModule(module);
    if (!definition) {
      throw new NotFoundException(`No settings registered for module "${module}"`);
    }

    const overrides = await this.loadModuleCache(module);
    const defaults = definition.schema.parse({});

    const fields: SettingsFieldResponse[] = Object.keys(definition.schema.shape).map(
      (key) => ({
        key,
        value: overrides.has(key) ? overrides.get(key) : defaults[key],
        default: defaults[key],
        isOverridden: overrides.has(key),
        metadata: definition.metadata[key],
      }),
    );

    return {
      module: definition.module,
      label: definition.label,
      fields,
    };
  }

  async getAllModuleSettings(): Promise<SettingsGroupResponse[]> {
    const definitions = this.registry.getAll();
    const results: SettingsGroupResponse[] = [];

    for (const def of definitions) {
      results.push(await this.getModuleSettings(def.module));
    }

    return results;
  }

  async upsertSettings(
    module: string,
    settings: Array<{ key: string; value: unknown }>,
    actorId: string,
  ): Promise<SettingsGroupResponse> {
    const definition = this.registry.getByModule(module);
    if (!definition) {
      throw new NotFoundException(`No settings registered for module "${module}"`);
    }

    const schemaKeys = Object.keys(definition.schema.shape);
    const errors: Array<{ key: string; message: string }> = [];

    for (const { key, value } of settings) {
      if (!schemaKeys.includes(key)) {
        errors.push({ key, message: `Unknown setting key "${key}" for module "${module}"` });
        continue;
      }

      const fieldSchema = definition.schema.shape[key];
      const result = fieldSchema.safeParse(value);
      if (!result.success) {
        const message = result.error.issues.map((i) => i.message).join('; ');
        errors.push({ key, message });
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: errors,
      });
    }

    const delegate = this.config.getSettingDelegate();

    for (const { key, value } of settings) {
      await delegate.upsert({
        where: { module_key: { module, key } },
        update: { value: value as never, updatedBy: actorId },
        create: { module, key, value: value as never, updatedBy: actorId },
      });
    }

    this.invalidateModuleCache(module);

    const event: SettingUpdatedEvent = {
      eventName: SETTINGS_SETTING_UPDATED,
      entityType: 'setting',
      entityId: module,
      actorId,
      correlationId: '',
      occurredAt: new Date().toISOString(),
      payload: {
        module,
        keys: settings.map((s) => s.key),
      },
    };
    this.eventEmitter.emit(SETTINGS_SETTING_UPDATED, event);

    this.logger.log(`Settings updated for module "${module}": ${settings.map((s) => s.key).join(', ')}`);

    return this.getModuleSettings(module);
  }

  async resetSetting(module: string, key: string): Promise<SettingsGroupResponse> {
    const definition = this.registry.getByModule(module);
    if (!definition) {
      throw new NotFoundException(`No settings registered for module "${module}"`);
    }

    if (!Object.keys(definition.schema.shape).includes(key)) {
      throw new NotFoundException(`Unknown setting key "${key}" for module "${module}"`);
    }

    const delegate = this.config.getSettingDelegate();

    try {
      await delegate.delete({
        where: { module_key: { module, key } },
      });
    } catch {
      // Setting was not overridden — nothing to delete
    }

    this.invalidateModuleCache(module);

    this.logger.log(`Setting reset to default: ${module}.${key}`);

    return this.getModuleSettings(module);
  }

  private async loadModuleCache(module: string): Promise<Map<string, unknown>> {
    const cached = this.cache.get(module);
    const now = Date.now();

    if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    const delegate = this.config.getSettingDelegate();
    let records: SettingRecord[];

    try {
      records = await delegate.findMany({ where: { module } });
    } catch {
      this.logger.warn(`Failed to load settings for module "${module}" from DB, using defaults`);
      records = [];
    }

    const data = new Map<string, unknown>();
    for (const record of records) {
      data.set(record.key, record.value);
    }

    this.cache.set(module, { data, loadedAt: now });
    return data;
  }

  private invalidateModuleCache(module: string) {
    this.cache.delete(module);
  }
}
