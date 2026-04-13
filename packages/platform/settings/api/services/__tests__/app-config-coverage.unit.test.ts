import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../app-config.service';
import type { SettingsStoreService } from '../settings-store.service';
import type { SettingsModuleDefinition } from '../../types';

function createMockStore() {
  return {
    getCached: vi.fn().mockReturnValue(undefined),
    getAllCachedByModule: vi.fn().mockReturnValue({}),
    upsert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  } as unknown as SettingsStoreService;
}

describe('AppConfigService - set() coverage', () => {
  let service: AppConfigService;
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    service = new AppConfigService(mockStore as any);
    service.register('notifications', {
      label: 'Notifications',
      defaults: { emailEnabled: true, maxRetries: 3 },
      metadata: {
        emailEnabled: { label: 'Enable Email', type: 'boolean' },
        maxRetries: { label: 'Max Retries', type: 'number' },
      },
    });
  });

  it('should call store.upsert with correct arguments for a valid key', async () => {
    await service.set('notifications', 'emailEnabled', false, 'user-abc');

    expect(mockStore.upsert).toHaveBeenCalledOnce();
    expect(mockStore.upsert).toHaveBeenCalledWith('notifications', 'emailEnabled', false, 'user-abc');
  });

  it('should throw NotFoundException when module is not registered', async () => {
    await expect(service.set('payments', 'amount', 100, 'user-1'))
      .rejects.toThrow(NotFoundException);
    await expect(service.set('payments', 'amount', 100, 'user-1'))
      .rejects.toThrow("Module 'payments' is not registered");
  });

  it('should throw NotFoundException when key does not exist in module defaults', async () => {
    await expect(service.set('notifications', 'nonExistentKey', 'value', 'user-1'))
      .rejects.toThrow(NotFoundException);
    await expect(service.set('notifications', 'nonExistentKey', 'value', 'user-1'))
      .rejects.toThrow("Key 'nonExistentKey' is not a valid config key for module 'notifications'");
  });

  it('should not call store.upsert when module validation fails', async () => {
    await expect(service.set('unknown', 'key', 'val', 'u1')).rejects.toThrow();

    expect(mockStore.upsert).not.toHaveBeenCalled();
  });

  it('should not call store.upsert when key validation fails', async () => {
    await expect(service.set('notifications', 'badKey', 'val', 'u1')).rejects.toThrow();

    expect(mockStore.upsert).not.toHaveBeenCalled();
  });

  it('should accept null as a valid value to set', async () => {
    await service.set('notifications', 'emailEnabled', null, 'user-1');

    expect(mockStore.upsert).toHaveBeenCalledWith('notifications', 'emailEnabled', null, 'user-1');
  });

  it('should accept object values', async () => {
    await service.set('notifications', 'maxRetries', { complex: true }, 'user-1');

    expect(mockStore.upsert).toHaveBeenCalledWith('notifications', 'maxRetries', { complex: true }, 'user-1');
  });
});

describe('AppConfigService - reset() coverage', () => {
  let service: AppConfigService;
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore();
    service = new AppConfigService(mockStore as any);
    service.register('notifications', {
      label: 'Notifications',
      defaults: { emailEnabled: true, maxRetries: 3 },
      metadata: {
        emailEnabled: { label: 'Enable Email', type: 'boolean' },
        maxRetries: { label: 'Max Retries', type: 'number' },
      },
    });
  });

  it('should call store.remove with the correct module and key', async () => {
    await service.reset('notifications', 'emailEnabled');

    expect(mockStore.remove).toHaveBeenCalledOnce();
    expect(mockStore.remove).toHaveBeenCalledWith('notifications', 'emailEnabled');
  });

  it('should throw NotFoundException when module is not registered', async () => {
    await expect(service.reset('unregistered', 'someKey'))
      .rejects.toThrow(NotFoundException);
    await expect(service.reset('unregistered', 'someKey'))
      .rejects.toThrow("Module 'unregistered' is not registered");
  });

  it('should not call store.remove when module validation fails', async () => {
    await expect(service.reset('unknown', 'key')).rejects.toThrow();

    expect(mockStore.remove).not.toHaveBeenCalled();
  });

  it('should allow resetting a key that does not exist in defaults (no key validation)', async () => {
    // reset() only validates module registration, not key existence
    await service.reset('notifications', 'arbitraryKey');

    expect(mockStore.remove).toHaveBeenCalledWith('notifications', 'arbitraryKey');
  });

  it('should allow resetting multiple keys sequentially', async () => {
    await service.reset('notifications', 'emailEnabled');
    await service.reset('notifications', 'maxRetries');

    expect(mockStore.remove).toHaveBeenCalledTimes(2);
    expect(mockStore.remove).toHaveBeenCalledWith('notifications', 'emailEnabled');
    expect(mockStore.remove).toHaveBeenCalledWith('notifications', 'maxRetries');
  });
});
