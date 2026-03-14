import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SettingsService } from '../settings.service';
import { SettingsRegistryService } from '../settings-registry.service';
import { SETTINGS_SETTING_UPDATED } from '../../events/types';
import type { SettingsModuleConfig, SettingRecord, SettingsSchemaDefinition } from '../../types';

function createMockDelegate() {
  const store = new Map<string, SettingRecord>();

  return {
    store,
    findByModule: vi.fn(async (module: string) => {
      const records: SettingRecord[] = [];
      for (const record of store.values()) {
        if (record.module === module) {
          records.push(record);
        }
      }
      return records;
    }),
    upsert: vi.fn(
      async (data: { module: string; key: string; value: unknown; updatedBy: string }) => {
        const compositeKey = `${data.module}:${data.key}`;
        const existing = store.get(compositeKey);
        if (existing) {
          const updated = { ...existing, value: data.value, updatedBy: data.updatedBy, updatedAt: new Date() };
          store.set(compositeKey, updated);
          return updated;
        }
        const created: SettingRecord = {
          id: `id-${compositeKey}`,
          module: data.module,
          key: data.key,
          value: data.value,
          updatedBy: data.updatedBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.set(compositeKey, created);
        return created;
      },
    ),
    deleteByModuleAndKey: vi.fn(async (module: string, key: string) => {
      const compositeKey = `${module}:${key}`;
      const record = store.get(compositeKey);
      if (!record) throw new Error('Record to delete does not exist.');
      store.delete(compositeKey);
    }),
  };
}

const testSchema = z.object({
  timeout: z.number().min(1).max(600).default(30),
  enabled: z.boolean().default(true),
  mode: z.string().default('normal'),
});

const testDefinition: SettingsSchemaDefinition = {
  module: 'test',
  label: 'Test Module',
  schema: testSchema,
  metadata: {
    timeout: { label: 'Timeout', type: 'number', min: 1, max: 600 },
    enabled: { label: 'Enabled', type: 'boolean' },
    mode: { label: 'Mode', type: 'string' },
  },
};

describe('SettingsService', () => {
  let service: SettingsService;
  let registry: SettingsRegistryService;
  let mockDelegate: ReturnType<typeof createMockDelegate>;
  let mockEventEmitter: { emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    registry = new SettingsRegistryService();
    registry.register(testDefinition);

    mockDelegate = createMockDelegate();
    mockEventEmitter = { emit: vi.fn() };

    const config: SettingsModuleConfig = {
      getSettingDelegate: () => mockDelegate as never,
    };

    service = new SettingsService(
      config,
      registry,
      mockEventEmitter as never,
    );
  });

  describe('get', () => {
    it('should return default value when no DB override exists', async () => {
      const result = await service.get('test', 'timeout', 30);
      expect(result).toBe(30);
    });

    it('should return DB override when it exists', async () => {
      mockDelegate.store.set('test:timeout', {
        id: 'id-1',
        module: 'test',
        key: 'timeout',
        value: 60,
        updatedBy: 'actor-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.get('test', 'timeout', 30);
      expect(result).toBe(60);
    });

    it('should use cache on subsequent calls', async () => {
      await service.get('test', 'timeout', 30);
      await service.get('test', 'timeout', 30);

      expect(mockDelegate.findByModule).toHaveBeenCalledTimes(1);
    });
  });

  describe('getModuleSettings', () => {
    it('should throw NotFoundException for unregistered module', async () => {
      await expect(service.getModuleSettings('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return all fields with defaults when no overrides exist', async () => {
      const result = await service.getModuleSettings('test');

      expect(result.module).toBe('test');
      expect(result.label).toBe('Test Module');
      expect(result.fields).toHaveLength(3);

      const timeoutField = result.fields.find((f) => f.key === 'timeout')!;
      expect(timeoutField.value).toBe(30);
      expect(timeoutField.default).toBe(30);
      expect(timeoutField.isOverridden).toBe(false);
    });

    it('should show overridden values when DB overrides exist', async () => {
      mockDelegate.store.set('test:timeout', {
        id: 'id-1',
        module: 'test',
        key: 'timeout',
        value: 120,
        updatedBy: 'actor-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getModuleSettings('test');
      const timeoutField = result.fields.find((f) => f.key === 'timeout')!;

      expect(timeoutField.value).toBe(120);
      expect(timeoutField.default).toBe(30);
      expect(timeoutField.isOverridden).toBe(true);
    });
  });

  describe('getAllModuleSettings', () => {
    it('should return settings for all registered modules', async () => {
      const results = await service.getAllModuleSettings();
      expect(results).toHaveLength(1);
      expect(results[0].module).toBe('test');
    });
  });

  describe('upsertSettings', () => {
    it('should save valid settings to DB', async () => {
      const result = await service.upsertSettings(
        'test',
        [{ key: 'timeout', value: 60 }],
        'actor-1',
      );

      expect(mockDelegate.upsert).toHaveBeenCalledTimes(1);
      const timeoutField = result.fields.find((f) => f.key === 'timeout')!;
      expect(timeoutField.value).toBe(60);
      expect(timeoutField.isOverridden).toBe(true);
    });

    it('should emit SETTINGS_SETTING_UPDATED event', async () => {
      await service.upsertSettings(
        'test',
        [{ key: 'timeout', value: 60 }],
        'actor-1',
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        SETTINGS_SETTING_UPDATED,
        expect.objectContaining({
          eventName: SETTINGS_SETTING_UPDATED,
          entityType: 'setting',
          entityId: 'test',
          actorId: 'actor-1',
          payload: {
            module: 'test',
            keys: ['timeout'],
          },
        }),
      );
    });

    it('should invalidate cache after upsert', async () => {
      // Populate cache
      await service.get('test', 'timeout', 30);
      expect(mockDelegate.findByModule).toHaveBeenCalledTimes(1);

      // Upsert invalidates cache, then getModuleSettings reloads it
      await service.upsertSettings(
        'test',
        [{ key: 'timeout', value: 60 }],
        'actor-1',
      );

      // Next get should use the cache populated by getModuleSettings OR hit DB if invalidated
      mockDelegate.findByModule.mockClear();
      await service.get('test', 'timeout', 30);
      const result = await service.get('test', 'timeout', 30);
      expect(result).toBe(60); // Must reflect the upserted value, not the old default
    });

    it('should throw NotFoundException for unregistered module', async () => {
      await expect(
        service.upsertSettings('nonexistent', [{ key: 'foo', value: 'bar' }], 'actor-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for unknown key', async () => {
      await expect(
        service.upsertSettings('test', [{ key: 'unknown', value: 'bar' }], 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid value', async () => {
      await expect(
        service.upsertSettings('test', [{ key: 'timeout', value: -5 }], 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should save multiple settings at once', async () => {
      const result = await service.upsertSettings(
        'test',
        [
          { key: 'timeout', value: 60 },
          { key: 'enabled', value: false },
        ],
        'actor-1',
      );

      expect(mockDelegate.upsert).toHaveBeenCalledTimes(2);

      const timeoutField = result.fields.find((f) => f.key === 'timeout')!;
      const enabledField = result.fields.find((f) => f.key === 'enabled')!;
      expect(timeoutField.value).toBe(60);
      expect(enabledField.value).toBe(false);
    });
  });

  describe('resetSetting', () => {
    it('should delete the override from DB', async () => {
      // First create an override
      await service.upsertSettings('test', [{ key: 'timeout', value: 60 }], 'actor-1');

      const result = await service.resetSetting('test', 'timeout');
      const timeoutField = result.fields.find((f) => f.key === 'timeout')!;

      expect(timeoutField.value).toBe(30); // Back to default
      expect(timeoutField.isOverridden).toBe(false);
      expect(mockDelegate.deleteByModuleAndKey).toHaveBeenCalled();
    });

    it('should not throw if setting was not overridden', async () => {
      const result = await service.resetSetting('test', 'timeout');
      const timeoutField = result.fields.find((f) => f.key === 'timeout')!;
      expect(timeoutField.value).toBe(30);
    });

    it('should throw NotFoundException for unregistered module', async () => {
      await expect(service.resetSetting('nonexistent', 'foo')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for unknown key', async () => {
      await expect(service.resetSetting('test', 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
