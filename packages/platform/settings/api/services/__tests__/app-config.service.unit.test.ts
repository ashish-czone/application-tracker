import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../app-config.service';
import { SettingsStoreService } from '../settings-store.service';
import type { SettingsModuleDefinition } from '../../types';

function createMockStore() {
  return {
    getCached: vi.fn().mockReturnValue(undefined),
    getAllCachedByModule: vi.fn().mockReturnValue({}),
    upsert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  } as unknown as SettingsStoreService;
}

const notificationsDefinition: SettingsModuleDefinition = {
  label: 'Notifications',
  defaults: {
    emailEnabled: true,
    smsEnabled: false,
    maxRetries: 3,
  },
  metadata: {
    emailEnabled: { label: 'Email Enabled', type: 'boolean', description: 'Enable email notifications' },
    smsEnabled: { label: 'SMS Enabled', type: 'boolean', description: 'Enable SMS notifications' },
    maxRetries: { label: 'Max Retries', type: 'number', min: 0, max: 10 },
  },
};

const billingDefinition: SettingsModuleDefinition = {
  label: 'Billing',
  defaults: {
    currency: 'USD',
    taxRate: 0.1,
  },
  metadata: {
    currency: { label: 'Currency', type: 'string', options: ['USD', 'EUR', 'GBP'] },
    taxRate: { label: 'Tax Rate', type: 'number', min: 0, max: 1 },
  },
};

describe('AppConfigService', () => {
  let service: AppConfigService;
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    service = new AppConfigService(mockStore as any);
  });

  describe('register', () => {
    it('should register a module definition', () => {
      service.register('notifications', notificationsDefinition);

      expect(service.has('notifications')).toBe(true);
    });

    it('should allow registering multiple modules', () => {
      service.register('notifications', notificationsDefinition);
      service.register('billing', billingDefinition);

      expect(service.has('notifications')).toBe(true);
      expect(service.has('billing')).toBe(true);
    });

    it('should overwrite a previously registered module', () => {
      service.register('notifications', notificationsDefinition);

      const updatedDefinition: SettingsModuleDefinition = {
        label: 'Updated Notifications',
        defaults: { emailEnabled: false },
        metadata: { emailEnabled: { label: 'Email', type: 'boolean' } },
      };
      service.register('notifications', updatedDefinition);

      const group = service.getByModule('notifications');
      expect(group.label).toBe('Updated Notifications');
    });
  });

  describe('has', () => {
    it('should return false for unregistered module', () => {
      expect(service.has('nonexistent')).toBe(false);
    });

    it('should return true for registered module', () => {
      service.register('notifications', notificationsDefinition);
      expect(service.has('notifications')).toBe(true);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      service.register('notifications', notificationsDefinition);
    });

    it('should return DB override when cached value exists', () => {
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

      const result = service.get<boolean>('notifications', 'emailEnabled');

      expect(result).toBe(false);
      expect(mockStore.getCached).toHaveBeenCalledWith('notifications', 'emailEnabled');
    });

    it('should fall back to registered default when no DB override', () => {
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      const result = service.get<boolean>('notifications', 'emailEnabled');

      expect(result).toBe(true);
    });

    it('should fall back to inline default when no DB override and no registered default', () => {
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      const result = service.get<string>('notifications', 'unknownKey', 'fallback');

      expect(result).toBe('fallback');
    });

    it('should throw NotFoundException when no value found anywhere', () => {
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      expect(() => service.get('unregistered', 'key'))
        .toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message', () => {
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      expect(() => service.get('unregistered', 'someKey'))
        .toThrow("Config key 'someKey' not found in module 'unregistered'");
    });

    it('should prioritize DB override over registered default', () => {
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce(99);

      const result = service.get<number>('notifications', 'maxRetries');

      expect(result).toBe(99);
    });

    it('should prioritize registered default over inline default', () => {
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce(undefined);

      const result = service.get<number>('notifications', 'maxRetries', 999);

      expect(result).toBe(3);
    });

    it('should return falsy values from cache correctly', () => {
      // 0 is a valid cached value
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce(0);
      expect(service.get<number>('notifications', 'maxRetries')).toBe(0);

      // false is a valid cached value
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
      expect(service.get<boolean>('notifications', 'emailEnabled')).toBe(false);

      // empty string is a valid cached value
      (mockStore.getCached as ReturnType<typeof vi.fn>).mockReturnValueOnce('');
      expect(service.get<string>('notifications', 'emailEnabled')).toBe('');
    });
  });

  describe('set', () => {
    beforeEach(() => {
      service.register('notifications', notificationsDefinition);
    });

    it('should upsert value via store', async () => {
      await service.set('notifications', 'emailEnabled', false, 'admin-1');

      expect(mockStore.upsert).toHaveBeenCalledWith('notifications', 'emailEnabled', false, 'admin-1');
    });

    it('should throw NotFoundException for unregistered module', async () => {
      await expect(service.set('unregistered', 'key', 'val', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message for unregistered module', async () => {
      await expect(service.set('unregistered', 'key', 'val', 'user-1'))
        .rejects.toThrow("Module 'unregistered' is not registered");
    });

    it('should throw NotFoundException for invalid key in registered module', async () => {
      await expect(service.set('notifications', 'invalidKey', 'val', 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message for invalid key', async () => {
      await expect(service.set('notifications', 'invalidKey', 'val', 'user-1'))
        .rejects.toThrow("Key 'invalidKey' is not a valid config key for module 'notifications'");
    });

    it('should allow setting any valid key', async () => {
      await service.set('notifications', 'maxRetries', 5, 'admin-1');

      expect(mockStore.upsert).toHaveBeenCalledWith('notifications', 'maxRetries', 5, 'admin-1');
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      service.register('notifications', notificationsDefinition);
    });

    it('should remove value via store', async () => {
      await service.reset('notifications', 'emailEnabled');

      expect(mockStore.remove).toHaveBeenCalledWith('notifications', 'emailEnabled');
    });

    it('should throw NotFoundException for unregistered module', async () => {
      await expect(service.reset('unregistered', 'key'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message', async () => {
      await expect(service.reset('unregistered', 'key'))
        .rejects.toThrow("Module 'unregistered' is not registered");
    });
  });

  describe('getAll', () => {
    it('should return empty array when no modules registered', () => {
      const result = service.getAll();

      expect(result).toEqual([]);
    });

    it('should return groups for all registered modules', () => {
      service.register('notifications', notificationsDefinition);
      service.register('billing', billingDefinition);

      const result = service.getAll();

      expect(result).toHaveLength(2);
      const moduleNames = result.map((g) => g.module);
      expect(moduleNames).toContain('notifications');
      expect(moduleNames).toContain('billing');
    });

    it('should include correct labels', () => {
      service.register('notifications', notificationsDefinition);

      const result = service.getAll();

      expect(result[0].label).toBe('Notifications');
    });

    it('should build fields with default values when no overrides', () => {
      service.register('notifications', notificationsDefinition);
      (mockStore.getAllCachedByModule as ReturnType<typeof vi.fn>).mockReturnValueOnce({});

      const result = service.getAll();
      const fields = result[0].fields;

      expect(fields).toHaveLength(3);

      const emailField = fields.find((f) => f.key === 'emailEnabled')!;
      expect(emailField.value).toBe(true);
      expect(emailField.default).toBe(true);
      expect(emailField.isOverridden).toBe(false);
      expect(emailField.metadata.label).toBe('Email Enabled');
      expect(emailField.metadata.type).toBe('boolean');
    });

    it('should mark overridden fields and use override values', () => {
      service.register('notifications', notificationsDefinition);
      (mockStore.getAllCachedByModule as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        emailEnabled: false,
        maxRetries: 10,
      });

      const result = service.getAll();
      const fields = result[0].fields;

      const emailField = fields.find((f) => f.key === 'emailEnabled')!;
      expect(emailField.value).toBe(false);
      expect(emailField.default).toBe(true);
      expect(emailField.isOverridden).toBe(true);

      const retriesField = fields.find((f) => f.key === 'maxRetries')!;
      expect(retriesField.value).toBe(10);
      expect(retriesField.default).toBe(3);
      expect(retriesField.isOverridden).toBe(true);

      const smsField = fields.find((f) => f.key === 'smsEnabled')!;
      expect(smsField.value).toBe(false);
      expect(smsField.isOverridden).toBe(false);
    });
  });

  describe('getByModule', () => {
    it('should throw NotFoundException for unregistered module', () => {
      expect(() => service.getByModule('nonexistent'))
        .toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message', () => {
      expect(() => service.getByModule('nonexistent'))
        .toThrow("Module 'nonexistent' is not registered");
    });

    it('should return group for registered module', () => {
      service.register('notifications', notificationsDefinition);
      (mockStore.getAllCachedByModule as ReturnType<typeof vi.fn>).mockReturnValueOnce({});

      const result = service.getByModule('notifications');

      expect(result.module).toBe('notifications');
      expect(result.label).toBe('Notifications');
      expect(result.fields).toHaveLength(3);
    });

    it('should use fallback metadata when field metadata is missing', () => {
      const definitionWithMissingMetadata: SettingsModuleDefinition = {
        label: 'Test',
        defaults: { someKey: 'val' },
        metadata: {},
      };
      service.register('test', definitionWithMissingMetadata);
      (mockStore.getAllCachedByModule as ReturnType<typeof vi.fn>).mockReturnValueOnce({});

      const result = service.getByModule('test');
      const field = result.fields[0];

      expect(field.metadata.label).toBe('someKey');
      expect(field.metadata.type).toBe('string');
    });

    it('should pass through labeled options (object form)', () => {
      const definition: SettingsModuleDefinition = {
        label: 'Locale',
        defaults: { currency: 'USD' },
        metadata: {
          currency: {
            label: 'Currency',
            type: 'string',
            options: [
              { value: 'USD', label: 'USD — US Dollar ($)' },
              { value: 'EUR', label: 'EUR — Euro (€)' },
            ],
          },
        },
      };
      service.register('locale', definition);
      (mockStore.getAllCachedByModule as ReturnType<typeof vi.fn>).mockReturnValueOnce({});

      const result = service.getByModule('locale');
      const field = result.fields[0];

      expect(field.metadata.options).toEqual([
        { value: 'USD', label: 'USD — US Dollar ($)' },
        { value: 'EUR', label: 'EUR — Euro (€)' },
      ]);
    });

    it('should pass through string-form options (backward compat)', () => {
      service.register('billing', billingDefinition);
      (mockStore.getAllCachedByModule as ReturnType<typeof vi.fn>).mockReturnValueOnce({});

      const result = service.getByModule('billing');
      const currencyField = result.fields.find((f) => f.key === 'currency')!;

      expect(currencyField.metadata.options).toEqual(['USD', 'EUR', 'GBP']);
    });

    it('should omit fields marked hidden from the group response', () => {
      const definition: SettingsModuleDefinition = {
        label: 'Site',
        defaults: {
          siteName: 'Studio',
          theme: { presetId: 'minimal' },
          companyLogo: '',
        },
        metadata: {
          siteName: { label: 'Site name', type: 'string' },
          theme: { label: 'Theme', type: 'string', hidden: true },
          companyLogo: { label: 'Company logo', type: 'string', hidden: true },
        },
      };
      service.register('site', definition);
      (mockStore.getAllCachedByModule as ReturnType<typeof vi.fn>).mockReturnValueOnce({});

      const result = service.getByModule('site');
      const keys = result.fields.map((f) => f.key);

      expect(keys).toEqual(['siteName']);
    });
  });
});
