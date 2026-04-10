import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LookupResolverService } from '../lookup-resolver.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

function createMockLogger() {
  return {
    forContext: vi.fn().mockReturnValue({
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  };
}

function createMockTable() {
  return {
    id: 'id_column',
    name: 'name_column',
    email: 'email_column',
  };
}

describe('LookupResolverService', () => {
  let service: LookupResolverService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    LookupResolverService.clearRegistry();
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    const mockLogger = createMockLogger();
    service = new LookupResolverService(databaseService, mockLogger as any);
  });

  // --- register ---

  describe('register', () => {
    it('should store config for an entity', () => {
      const table = createMockTable();
      service.register({
        entity: 'users',
        table,
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name', 'email'],
      });

      expect(service.isRegistered('users')).toBe(true);
    });

    it('should overwrite config on repeated registration', () => {
      const table = createMockTable();
      service.register({
        entity: 'users',
        table,
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      service.register({
        entity: 'users',
        table,
        labelField: 'email',
        valueField: 'id',
        searchFields: ['email'],
      });

      expect(service.isRegistered('users')).toBe(true);
      expect(service.getRegisteredEntities()).toEqual(['users']);
    });
  });

  // --- isRegistered ---

  describe('isRegistered', () => {
    it('should return true for registered entity', () => {
      service.register({
        entity: 'users',
        table: createMockTable(),
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      expect(service.isRegistered('users')).toBe(true);
    });

    it('should return false for unregistered entity', () => {
      expect(service.isRegistered('nonexistent')).toBe(false);
    });
  });

  // --- getRegisteredEntities ---

  describe('getRegisteredEntities', () => {
    it('should return all registered entity names', () => {
      service.register({
        entity: 'users',
        table: createMockTable(),
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      service.register({
        entity: 'departments',
        table: createMockTable(),
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      const entities = service.getRegisteredEntities();
      expect(entities).toContain('users');
      expect(entities).toContain('departments');
      expect(entities).toHaveLength(2);
    });

    it('should return empty array when nothing is registered', () => {
      expect(service.getRegisteredEntities()).toEqual([]);
    });
  });

  // --- search ---

  describe('search', () => {
    it('should return results for a registered entity', async () => {
      const table = createMockTable();
      service.register({
        entity: 'users',
        table,
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name', 'email'],
      });

      const rows = [
        { label: 'Alice', value: 'u1' },
        { label: 'Bob', value: 'u2' },
      ];
      mockDb._chain.limit.mockResolvedValueOnce(rows);

      const result = await service.search('users', 'al');

      expect(result).toEqual([
        { label: 'Alice', value: 'u1' },
        { label: 'Bob', value: 'u2' },
      ]);
    });

    it('should return empty array for unregistered entity', async () => {
      const result = await service.search('nonexistent', 'query');

      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should handle null label/value gracefully', async () => {
      const table = createMockTable();
      service.register({
        entity: 'users',
        table,
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      const rows = [
        { label: null, value: null },
      ];
      mockDb._chain.limit.mockResolvedValueOnce(rows);

      const result = await service.search('users', 'query');

      expect(result).toEqual([{ label: '', value: '' }]);
    });
  });

  // --- getLabel ---

  describe('getLabel', () => {
    it('should resolve a single value to its label', async () => {
      const table = createMockTable();
      service.register({
        entity: 'users',
        table,
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      mockDb._chain.limit.mockResolvedValueOnce([{ label: 'Alice' }]);

      const result = await service.getLabel('users', 'u1');

      expect(result).toBe('Alice');
    });

    it('should return null for unregistered entity', async () => {
      const result = await service.getLabel('nonexistent', 'u1');

      expect(result).toBeNull();
    });

    it('should return null when value not found', async () => {
      const table = createMockTable();
      service.register({
        entity: 'users',
        table,
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.getLabel('users', 'nonexistent_id');

      expect(result).toBeNull();
    });
  });

  // --- getBatchLabels ---

  describe('getBatchLabels', () => {
    it('should bulk resolve values to labels', async () => {
      const table = createMockTable();
      service.register({
        entity: 'users',
        table,
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      const rows = [
        { label: 'Alice', value: 'u1' },
        { label: 'Bob', value: 'u2' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(rows);

      const result = await service.getBatchLabels('users', ['u1', 'u2']);

      expect(result.get('u1')).toBe('Alice');
      expect(result.get('u2')).toBe('Bob');
      expect(result.size).toBe(2);
    });

    it('should return empty map for unregistered entity', async () => {
      const result = await service.getBatchLabels('nonexistent', ['u1']);

      expect(result.size).toBe(0);
    });

    it('should return empty map for empty values array', async () => {
      const table = createMockTable();
      service.register({
        entity: 'users',
        table,
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      const result = await service.getBatchLabels('users', []);

      expect(result.size).toBe(0);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should handle null labels gracefully', async () => {
      const table = createMockTable();
      service.register({
        entity: 'users',
        table,
        labelField: 'name',
        valueField: 'id',
        searchFields: ['name'],
      });

      const rows = [
        { label: null, value: 'u1' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(rows);

      const result = await service.getBatchLabels('users', ['u1']);

      expect(result.get('u1')).toBe('');
    });
  });
});
