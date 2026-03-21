import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FieldValueService } from '../field-value.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

describe('FieldValueService', () => {
  let service: FieldValueService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    service = new FieldValueService(databaseService);
  });

  // --- getValues ---

  describe('getValues', () => {
    it('should return typed values from EAV rows', async () => {
      const rows = [
        { fieldKey: 'status', valueText: 'active', valueNumber: null, valueDate: null, valueDatetime: null, valueBoolean: null },
        { fieldKey: 'age', valueText: null, valueNumber: '25', valueDate: null, valueDatetime: null, valueBoolean: null },
        { fieldKey: 'is_active', valueText: null, valueNumber: null, valueDate: null, valueDatetime: null, valueBoolean: true },
      ];
      mockDb._chain.where.mockResolvedValueOnce(rows);

      const result = await service.getValues('candidates', 'c1');

      expect(result.status).toBe('active');
      expect(result.age).toBe(25);
      expect(result.is_active).toBe(true);
    });

    it('should return empty object when no values exist', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      const result = await service.getValues('candidates', 'c1');

      expect(result).toEqual({});
    });

    it('should handle date and datetime values', async () => {
      const dt = new Date('2024-01-15T10:00:00Z');
      const rows = [
        { fieldKey: 'birth_date', valueText: null, valueNumber: null, valueDate: '2024-01-15', valueDatetime: null, valueBoolean: null },
        { fieldKey: 'created_at', valueText: null, valueNumber: null, valueDate: null, valueDatetime: dt, valueBoolean: null },
      ];
      mockDb._chain.where.mockResolvedValueOnce(rows);

      const result = await service.getValues('candidates', 'c1');

      expect(result.birth_date).toBe('2024-01-15');
      expect(result.created_at).toEqual(dt);
    });
  });

  // --- setValues ---

  describe('setValues', () => {
    it('should route text field to valueText column', async () => {
      const fieldDefs = [
        { fieldKey: 'name', fieldType: 'text' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(fieldDefs);

      await service.setValues('candidates', 'c1', { name: 'Alice' });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should route number field to valueNumber column', async () => {
      const fieldDefs = [
        { fieldKey: 'age', fieldType: 'number' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(fieldDefs);

      await service.setValues('candidates', 'c1', { age: 30 });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should route boolean field to valueBoolean column', async () => {
      const fieldDefs = [
        { fieldKey: 'active', fieldType: 'boolean' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(fieldDefs);

      await service.setValues('candidates', 'c1', { active: true });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should route date field to valueDate column', async () => {
      const fieldDefs = [
        { fieldKey: 'dob', fieldType: 'date' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(fieldDefs);

      await service.setValues('candidates', 'c1', { dob: '2024-01-15' });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should route datetime field to valueDatetime column', async () => {
      const fieldDefs = [
        { fieldKey: 'start', fieldType: 'datetime' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(fieldDefs);

      await service.setValues('candidates', 'c1', { start: new Date() });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should delete value row when value is null', async () => {
      const fieldDefs = [
        { fieldKey: 'name', fieldType: 'text' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(fieldDefs);

      await service.setValues('candidates', 'c1', { name: null });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should delete value row when value is empty string', async () => {
      const fieldDefs = [
        { fieldKey: 'name', fieldType: 'text' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(fieldDefs);

      await service.setValues('candidates', 'c1', { name: '' });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should delete value row when value is undefined', async () => {
      const fieldDefs = [
        { fieldKey: 'name', fieldType: 'text' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(fieldDefs);

      await service.setValues('candidates', 'c1', { name: undefined });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should do nothing when values object is empty', async () => {
      await service.setValues('candidates', 'c1', {});

      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should skip unknown fields', async () => {
      // Field definition lookup returns no matching fields
      mockDb._chain.where.mockResolvedValueOnce([]);

      await service.setValues('candidates', 'c1', { unknown_field: 'value' });

      // Should not insert or delete since field type is unknown
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('should handle multiple values in a single call (upsert)', async () => {
      const fieldDefs = [
        { fieldKey: 'name', fieldType: 'text' },
        { fieldKey: 'age', fieldType: 'number' },
        { fieldKey: 'active', fieldType: 'boolean' },
      ];
      mockDb._chain.where.mockResolvedValueOnce(fieldDefs);

      await service.setValues('candidates', 'c1', {
        name: 'Alice',
        age: 30,
        active: true,
      });

      // Should call insert 3 times (one per field)
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });
  });

  // --- deleteValues ---

  describe('deleteValues', () => {
    it('should remove all values for an entity', async () => {
      await service.deleteValues('candidates', 'c1');

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  // --- getBatchValues ---

  describe('getBatchValues', () => {
    it('should return values grouped by entity ID', async () => {
      const rows = [
        { entityId: 'c1', fieldKey: 'name', valueText: 'Alice', valueNumber: null, valueDate: null, valueDatetime: null, valueBoolean: null },
        { entityId: 'c1', fieldKey: 'age', valueText: null, valueNumber: '25', valueDate: null, valueDatetime: null, valueBoolean: null },
        { entityId: 'c2', fieldKey: 'name', valueText: 'Bob', valueNumber: null, valueDate: null, valueDatetime: null, valueBoolean: null },
      ];
      mockDb._chain.where.mockResolvedValueOnce(rows);

      const result = await service.getBatchValues('candidates', ['c1', 'c2']);

      expect(result.get('c1')).toEqual({ name: 'Alice', age: 25 });
      expect(result.get('c2')).toEqual({ name: 'Bob' });
    });

    it('should return empty map for empty entity IDs array', async () => {
      const result = await service.getBatchValues('candidates', []);

      expect(result.size).toBe(0);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('should handle single query for multiple entities', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);

      await service.getBatchValues('candidates', ['c1', 'c2', 'c3']);

      // Only 1 select call for all entities
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  // --- checkUniqueness ---

  describe('checkUniqueness', () => {
    it('should return true when value is unique', async () => {
      // field definition with isUnique=true
      mockDb._chain.limit
        .mockResolvedValueOnce([{ fieldKey: 'email', fieldType: 'text', isUnique: true }])
        .mockResolvedValueOnce([]);  // no duplicate found

      const result = await service.checkUniqueness('candidates', 'email', 'test@example.com');

      expect(result).toBe(true);
    });

    it('should return false when duplicate exists', async () => {
      mockDb._chain.limit
        .mockResolvedValueOnce([{ fieldKey: 'email', fieldType: 'text', isUnique: true }])
        .mockResolvedValueOnce([{ exists: true }]); // duplicate found

      const result = await service.checkUniqueness('candidates', 'email', 'test@example.com');

      expect(result).toBe(false);
    });

    it('should return true when field is not unique (no constraint)', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ fieldKey: 'name', fieldType: 'text', isUnique: false }]);

      const result = await service.checkUniqueness('candidates', 'name', 'Alice');

      expect(result).toBe(true);
    });

    it('should return true when field definition not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.checkUniqueness('candidates', 'nonexistent', 'value');

      expect(result).toBe(true);
    });

    it('should exclude a specific entity ID from uniqueness check', async () => {
      mockDb._chain.limit
        .mockResolvedValueOnce([{ fieldKey: 'email', fieldType: 'text', isUnique: true }])
        .mockResolvedValueOnce([]); // no other entity with this value

      const result = await service.checkUniqueness('candidates', 'email', 'test@example.com', 'c1');

      expect(result).toBe(true);
    });
  });
});
