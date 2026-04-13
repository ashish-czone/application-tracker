import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsStoreService } from '../settings-store.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

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

describe('SettingsStoreService - remove() coverage', () => {
  let service: SettingsStoreService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = createMockDatabaseService(mockDb);
    service = new SettingsStoreService(databaseService);
  });

  it('should call db.delete when removing a setting', async () => {
    await service.remove('notifications', 'emailEnabled');

    expect(mockDb.delete).toHaveBeenCalledOnce();
  });

  it('should remove the key from cache after deletion', async () => {
    // Populate cache via loadAll
    mockDb._chain.where.mockResolvedValueOnce([
      { module: 'notifications', key: 'emailEnabled', value: true },
      { module: 'notifications', key: 'smsEnabled', value: false },
    ]);
    await service.loadAll();

    expect(service.getCached('notifications', 'emailEnabled')).toBe(true);

    await service.remove('notifications', 'emailEnabled');

    expect(service.getCached('notifications', 'emailEnabled')).toBeUndefined();
  });

  it('should not affect other keys in the same module after removal', async () => {
    mockDb._chain.where.mockResolvedValueOnce([
      { module: 'mod', key: 'keyA', value: 'A' },
      { module: 'mod', key: 'keyB', value: 'B' },
      { module: 'mod', key: 'keyC', value: 'C' },
    ]);
    await service.loadAll();

    await service.remove('mod', 'keyB');

    expect(service.getCached('mod', 'keyA')).toBe('A');
    expect(service.getCached('mod', 'keyB')).toBeUndefined();
    expect(service.getCached('mod', 'keyC')).toBe('C');
  });

  it('should not affect other modules when removing a key', async () => {
    mockDb._chain.where.mockResolvedValueOnce([
      { module: 'mod1', key: 'shared', value: 'val1' },
      { module: 'mod2', key: 'shared', value: 'val2' },
    ]);
    await service.loadAll();

    await service.remove('mod1', 'shared');

    expect(service.getCached('mod1', 'shared')).toBeUndefined();
    expect(service.getCached('mod2', 'shared')).toBe('val2');
  });

  it('should handle removing a key from a module not in cache gracefully', async () => {
    await service.remove('nonexistent', 'anyKey');

    expect(mockDb.delete).toHaveBeenCalledOnce();
    expect(service.getCached('nonexistent', 'anyKey')).toBeUndefined();
  });
});

describe('SettingsStoreService - onModuleInit() coverage', () => {
  let service: SettingsStoreService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = createMockDatabaseService(mockDb);
    service = new SettingsStoreService(databaseService);
  });

  it('should call loadAll during initialization', async () => {
    const loadAllSpy = vi.spyOn(service, 'loadAll').mockResolvedValueOnce(undefined);

    await service.onModuleInit();

    expect(loadAllSpy).toHaveBeenCalledOnce();
  });

  it('should populate cache from DB when onModuleInit runs', async () => {
    mockDb._chain.where.mockResolvedValueOnce([
      { module: 'billing', key: 'currency', value: 'EUR' },
    ]);

    await service.onModuleInit();

    expect(service.getCached('billing', 'currency')).toBe('EUR');
  });

  it('should propagate errors from loadAll', async () => {
    vi.spyOn(service, 'loadAll').mockRejectedValueOnce(new Error('DB connection failed'));

    await expect(service.onModuleInit()).rejects.toThrow('DB connection failed');
  });
});
