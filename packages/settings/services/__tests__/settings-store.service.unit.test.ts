import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsStoreService } from '../settings-store.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

function createMockDatabaseService(mockDb: ReturnType<typeof createMockDb>) {
  return { db: mockDb } as any;
}

describe('SettingsStoreService', () => {
  let service: SettingsStoreService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = createMockDatabaseService(mockDb);
    service = new SettingsStoreService(databaseService);
  });

  describe('loadAll', () => {
    it('should load all settings from DB into cache', async () => {
      mockDb._chain.from.mockResolvedValueOnce([
        { module: 'notifications', key: 'emailEnabled', value: true },
        { module: 'notifications', key: 'smsEnabled', value: false },
        { module: 'billing', key: 'currency', value: 'USD' },
      ]);

      await service.loadAll();

      expect(service.getCached('notifications', 'emailEnabled')).toBe(true);
      expect(service.getCached('notifications', 'smsEnabled')).toBe(false);
      expect(service.getCached('billing', 'currency')).toBe('USD');
    });

    it('should clear existing cache before loading', async () => {
      // First load
      mockDb._chain.from.mockResolvedValueOnce([
        { module: 'mod', key: 'oldKey', value: 'oldValue' },
      ]);
      await service.loadAll();
      expect(service.getCached('mod', 'oldKey')).toBe('oldValue');

      // Second load with different data
      mockDb._chain.from.mockResolvedValueOnce([
        { module: 'mod', key: 'newKey', value: 'newValue' },
      ]);
      await service.loadAll();

      expect(service.getCached('mod', 'oldKey')).toBeUndefined();
      expect(service.getCached('mod', 'newKey')).toBe('newValue');
    });

    it('should handle empty database', async () => {
      mockDb._chain.from.mockResolvedValueOnce([]);

      await service.loadAll();

      expect(service.getCached('any', 'key')).toBeUndefined();
    });
  });

  describe('getCached', () => {
    it('should return undefined for non-existent module', () => {
      expect(service.getCached('nonexistent', 'key')).toBeUndefined();
    });

    it('should return undefined for non-existent key in existing module', async () => {
      mockDb._chain.from.mockResolvedValueOnce([
        { module: 'mod', key: 'exists', value: 'val' },
      ]);
      await service.loadAll();

      expect(service.getCached('mod', 'nonexistent')).toBeUndefined();
    });

    it('should return cached value for existing module and key', async () => {
      mockDb._chain.from.mockResolvedValueOnce([
        { module: 'mod', key: 'key1', value: 42 },
      ]);
      await service.loadAll();

      expect(service.getCached('mod', 'key1')).toBe(42);
    });
  });

  describe('getAllCachedByModule', () => {
    it('should return empty object for non-existent module', () => {
      expect(service.getAllCachedByModule('nonexistent')).toEqual({});
    });

    it('should return all cached key-value pairs for a module', async () => {
      mockDb._chain.from.mockResolvedValueOnce([
        { module: 'notifications', key: 'emailEnabled', value: true },
        { module: 'notifications', key: 'smsEnabled', value: false },
        { module: 'billing', key: 'currency', value: 'USD' },
      ]);
      await service.loadAll();

      expect(service.getAllCachedByModule('notifications')).toEqual({
        emailEnabled: true,
        smsEnabled: false,
      });
    });

    it('should not include keys from other modules', async () => {
      mockDb._chain.from.mockResolvedValueOnce([
        { module: 'mod1', key: 'key1', value: 'a' },
        { module: 'mod2', key: 'key2', value: 'b' },
      ]);
      await service.loadAll();

      const result = service.getAllCachedByModule('mod1');
      expect(result).toEqual({ key1: 'a' });
      expect(result).not.toHaveProperty('key2');
    });
  });

  describe('upsert', () => {
    it('should insert a new setting when none exists', async () => {
      // No existing record
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await service.upsert('mod', 'key1', 'value1', 'user-1');

      expect(mockDb.insert).toHaveBeenCalled();
      expect(service.getCached('mod', 'key1')).toBe('value1');
    });

    it('should update an existing setting', async () => {
      // Existing record found
      mockDb._chain.limit.mockResolvedValueOnce([{ id: 'setting-1', module: 'mod', key: 'key1', value: 'old' }]);

      await service.upsert('mod', 'key1', 'newValue', 'user-1');

      expect(mockDb.update).toHaveBeenCalled();
      expect(service.getCached('mod', 'key1')).toBe('newValue');
    });

    it('should update cache after upsert', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      expect(service.getCached('mod', 'key1')).toBeUndefined();

      await service.upsert('mod', 'key1', 'cached', 'user-1');

      expect(service.getCached('mod', 'key1')).toBe('cached');
    });

    it('should create module entry in cache if it does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await service.upsert('newModule', 'key1', 'val', 'user-1');

      expect(service.getCached('newModule', 'key1')).toBe('val');
    });

    it('should handle different value types', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);
      await service.upsert('mod', 'boolKey', true, 'user-1');
      expect(service.getCached('mod', 'boolKey')).toBe(true);

      mockDb._chain.limit.mockResolvedValueOnce([]);
      await service.upsert('mod', 'numKey', 42, 'user-1');
      expect(service.getCached('mod', 'numKey')).toBe(42);

      mockDb._chain.limit.mockResolvedValueOnce([]);
      await service.upsert('mod', 'objKey', { nested: true }, 'user-1');
      expect(service.getCached('mod', 'objKey')).toEqual({ nested: true });
    });
  });

  describe('remove', () => {
    it('should delete setting from DB and remove from cache', async () => {
      // Pre-populate cache
      mockDb._chain.from.mockResolvedValueOnce([
        { module: 'mod', key: 'key1', value: 'val' },
      ]);
      await service.loadAll();
      expect(service.getCached('mod', 'key1')).toBe('val');

      await service.remove('mod', 'key1');

      expect(mockDb.delete).toHaveBeenCalled();
      expect(service.getCached('mod', 'key1')).toBeUndefined();
    });

    it('should handle removing a key that is not in cache', async () => {
      await service.remove('nonexistent', 'key1');

      expect(mockDb.delete).toHaveBeenCalled();
      expect(service.getCached('nonexistent', 'key1')).toBeUndefined();
    });

    it('should not affect other keys in the same module', async () => {
      mockDb._chain.from.mockResolvedValueOnce([
        { module: 'mod', key: 'keep', value: 'yes' },
        { module: 'mod', key: 'remove', value: 'no' },
      ]);
      await service.loadAll();

      await service.remove('mod', 'remove');

      expect(service.getCached('mod', 'keep')).toBe('yes');
      expect(service.getCached('mod', 'remove')).toBeUndefined();
    });
  });

  describe('onModuleInit', () => {
    it('should call loadAll on module init', async () => {
      const loadAllSpy = vi.spyOn(service, 'loadAll').mockResolvedValueOnce(undefined);

      await service.onModuleInit();

      expect(loadAllSpy).toHaveBeenCalledOnce();
    });
  });
});
