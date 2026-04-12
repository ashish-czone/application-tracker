import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserPreferencesService } from '../user-preferences.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

function createMockDb() {
  const resolveQueue: unknown[] = [];

  const mockChain: Record<string, any> = {
    _enqueue: (...values: unknown[]) => { resolveQueue.push(...values); },
  };

  const methods = [
    'select', 'from', 'where', 'limit',
    'insert', 'values', 'returning',
    'update', 'set',
    'delete',
  ];

  for (const method of methods) {
    mockChain[method] = vi.fn().mockReturnValue(mockChain);
  }

  mockChain.then = (
    resolve: (v: unknown) => void,
  ) => {
    const value = resolveQueue.length > 0 ? resolveQueue.shift() : undefined;
    resolve(value);
  };

  return { db: mockChain, _chain: mockChain };
}

function createService() {
  const { db, _chain } = createMockDb();
  const service = new UserPreferencesService({ db } as any);
  return { service, db, _chain };
}

const now = new Date('2026-01-15T10:00:00.000Z');

function makePrefRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'pref-1',
    userId: 'user-1',
    namespace: 'theming',
    key: 'theme',
    value: { presetId: 'ocean' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let _chain: ReturnType<typeof createMockDb>['_chain'];

  beforeEach(() => {
    vi.clearAllMocks();
    ({ service, _chain } = createService());
  });

  describe('listForUser', () => {
    it('returns rows filtered by user', async () => {
      _chain._enqueue([makePrefRow(), makePrefRow({ id: 'pref-2', key: 'mode', value: 'dark' })]);

      const result = await service.listForUser('user-1');

      expect(result).toHaveLength(2);
      expect(_chain.select).toHaveBeenCalled();
      expect(_chain.where).toHaveBeenCalled();
    });

    it('returns empty array when user has no prefs', async () => {
      _chain._enqueue([]);

      const result = await service.listForUser('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getOne', () => {
    it('returns the pref when found', async () => {
      _chain._enqueue([makePrefRow()]);

      const result = await service.getOne('user-1', 'theming', 'theme');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('pref-1');
    });

    it('returns null when not found', async () => {
      _chain._enqueue([]);

      const result = await service.getOne('user-1', 'theming', 'theme');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('updates when a pref already exists', async () => {
      // getOne call
      _chain._enqueue([makePrefRow()]);
      // update().returning()
      _chain._enqueue([makePrefRow({ value: { presetId: 'forest' } })]);

      const result = await service.set('user-1', 'theming', 'theme', { presetId: 'forest' });

      expect(_chain.update).toHaveBeenCalled();
      expect(_chain.insert).not.toHaveBeenCalled();
      expect((result.value as any).presetId).toBe('forest');
    });

    it('inserts when no pref exists', async () => {
      // getOne call returns nothing
      _chain._enqueue([]);
      // insert().values().returning()
      _chain._enqueue([makePrefRow()]);

      const result = await service.set('user-1', 'theming', 'theme', { presetId: 'ocean' });

      expect(_chain.insert).toHaveBeenCalled();
      expect(_chain.update).not.toHaveBeenCalled();
      expect(result.id).toBe('pref-1');
    });
  });

  describe('delete', () => {
    it('issues a delete with user/namespace/key filters', async () => {
      await service.delete('user-1', 'theming', 'theme');

      expect(_chain.delete).toHaveBeenCalled();
      expect(_chain.where).toHaveBeenCalled();
    });
  });
});
