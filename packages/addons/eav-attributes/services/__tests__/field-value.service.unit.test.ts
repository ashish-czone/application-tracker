import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sql } from '@packages/database';
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
  let mockFieldDefService: { listByEntity: ReturnType<typeof vi.fn>; findByEntityAndKey: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    mockFieldDefService = {
      listByEntity: vi.fn().mockReturnValue([]),
      findByEntityAndKey: vi.fn().mockReturnValue(null),
    };
    service = new FieldValueService(databaseService, mockFieldDefService as any);
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

    it('should use provided tx instead of default db', async () => {
      const txMockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      const txMock = {
        select: vi.fn().mockReturnValue(txMockChain),
      };

      await service.getValues('candidates', 'c1', txMock);

      // Should use the tx, not the default db
      expect(txMock.select).toHaveBeenCalled();
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  // --- setValues ---

  describe('setValues', () => {
    it('should return { before, after } with applied changes', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { fieldKey: 'name', valueText: 'Old Name', valueNumber: null, valueDate: null, valueDatetime: null, valueBoolean: null },
      ]);
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'name', fieldType: 'text' }]);

      const result = await service.setValues('candidates', 'c1', { name: 'New Name' });

      expect(result.before).toEqual({ name: 'Old Name' });
      expect(result.after).toEqual({ name: 'New Name' });
    });

    it('should route text field to valueText column', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'name', fieldType: 'text' }]);

      await service.setValues('candidates', 'c1', { name: 'Alice' });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should route number field to valueNumber column', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'age', fieldType: 'number' }]);

      const result = await service.setValues('candidates', 'c1', { age: 30 });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.after.age).toBe(30);
    });

    it('should route boolean field to valueBoolean column', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'active', fieldType: 'boolean' }]);

      const result = await service.setValues('candidates', 'c1', { active: true });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.after.active).toBe(true);
    });

    it('should route date field to valueDate column', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'dob', fieldType: 'date' }]);

      const result = await service.setValues('candidates', 'c1', { dob: '2024-01-15' });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.after.dob).toBe('2024-01-15');
    });

    it('should route datetime field to valueDatetime column', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);
      const dt = new Date('2024-01-15T10:00:00Z');
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'start', fieldType: 'datetime' }]);

      const result = await service.setValues('candidates', 'c1', { start: dt });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.after.start).toEqual(dt);
    });

    it('should delete value row when value is null and remove from after', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { fieldKey: 'name', valueText: 'Alice', valueNumber: null, valueDate: null, valueDatetime: null, valueBoolean: null },
      ]);
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'name', fieldType: 'text' }]);

      const result = await service.setValues('candidates', 'c1', { name: null });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(result.before).toEqual({ name: 'Alice' });
      expect(result.after).toEqual({});
    });

    it('should delete value row when value is empty string', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { fieldKey: 'name', valueText: 'Alice', valueNumber: null, valueDate: null, valueDatetime: null, valueBoolean: null },
      ]);
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'name', fieldType: 'text' }]);

      const result = await service.setValues('candidates', 'c1', { name: '' });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(result.after.name).toBeUndefined();
    });

    it('should delete value row when value is undefined', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { fieldKey: 'name', valueText: 'Alice', valueNumber: null, valueDate: null, valueDatetime: null, valueBoolean: null },
      ]);
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'name', fieldType: 'text' }]);

      const result = await service.setValues('candidates', 'c1', { name: undefined });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should return { before, after } with same values when values object is empty', async () => {
      mockDb._chain.where.mockResolvedValueOnce([
        { fieldKey: 'name', valueText: 'Alice', valueNumber: null, valueDate: null, valueDatetime: null, valueBoolean: null },
      ]);

      const result = await service.setValues('candidates', 'c1', {});

      expect(result.before).toEqual({ name: 'Alice' });
      expect(result.after).toEqual({ name: 'Alice' });
      expect(mockDb.select).toHaveBeenCalledTimes(1); // only getValues
      expect(mockFieldDefService.listByEntity).not.toHaveBeenCalled();
    });

    it('should skip unknown fields', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);
      mockFieldDefService.listByEntity.mockReturnValue([]);

      const result = await service.setValues('candidates', 'c1', { unknown_field: 'value' });

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
      expect(result.before).toEqual({});
      expect(result.after).toEqual({});
    });

    it('should handle multiple values in a single call (upsert)', async () => {
      mockDb._chain.where.mockResolvedValueOnce([]);
      mockFieldDefService.listByEntity.mockReturnValue([
        { fieldKey: 'name', fieldType: 'text' },
        { fieldKey: 'age', fieldType: 'number' },
        { fieldKey: 'active', fieldType: 'boolean' },
      ]);

      const result = await service.setValues('candidates', 'c1', {
        name: 'Alice',
        age: 30,
        active: true,
      });

      expect(mockDb.insert).toHaveBeenCalledTimes(3);
      expect(result.after).toEqual({ name: 'Alice', age: 30, active: true });
    });

    it('should use provided tx instead of default db', async () => {
      const txMockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      };
      const txMock = {
        select: vi.fn().mockReturnValue(txMockChain),
        insert: vi.fn().mockReturnValue(txMockChain),
        delete: vi.fn().mockReturnValue(txMockChain),
      };

      // getValues inside setValues will use tx
      txMockChain.where.mockResolvedValueOnce([]); // getValues returns empty
      mockFieldDefService.listByEntity.mockReturnValue([{ fieldKey: 'name', fieldType: 'text' }]);

      await service.setValues('candidates', 'c1', { name: 'Alice' }, txMock);

      // Should use the tx, not the default db
      expect(txMock.select).toHaveBeenCalled();
      expect(txMock.insert).toHaveBeenCalled();
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
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
      mockFieldDefService.findByEntityAndKey.mockReturnValue({ fieldKey: 'email', fieldType: 'text', isUnique: true });
      mockDb._chain.limit.mockResolvedValueOnce([]); // no duplicate found

      const result = await service.checkUniqueness('candidates', 'email', 'test@example.com');

      expect(result).toBe(true);
    });

    it('should return false when duplicate exists', async () => {
      mockFieldDefService.findByEntityAndKey.mockReturnValue({ fieldKey: 'email', fieldType: 'text', isUnique: true });
      mockDb._chain.limit.mockResolvedValueOnce([{ exists: true }]); // duplicate found

      const result = await service.checkUniqueness('candidates', 'email', 'test@example.com');

      expect(result).toBe(false);
    });

    it('should return true when field is not unique (no constraint)', async () => {
      mockFieldDefService.findByEntityAndKey.mockReturnValue({ fieldKey: 'name', fieldType: 'text', isUnique: false });

      const result = await service.checkUniqueness('candidates', 'name', 'Alice');

      expect(result).toBe(true);
    });

    it('should return true when field definition not found', async () => {
      mockFieldDefService.findByEntityAndKey.mockReturnValue(null);

      const result = await service.checkUniqueness('candidates', 'nonexistent', 'value');

      expect(result).toBe(true);
    });

    it('should exclude a specific entity ID from uniqueness check', async () => {
      mockFieldDefService.findByEntityAndKey.mockReturnValue({ fieldKey: 'email', fieldType: 'text', isUnique: true });
      mockDb._chain.limit.mockResolvedValueOnce([]); // no other entity with this value

      const result = await service.checkUniqueness('candidates', 'email', 'test@example.com', 'c1');

      expect(result).toBe(true);
    });
  });

  // --- buildFilterCondition ---

  describe('buildFilterCondition', () => {
    const entityIdCol = sql`e.id`;

    /** Recursively flatten a Drizzle SQL object into a string for assertion. */
    function flattenSql(s: any): string {
      if (!s || !s.queryChunks) return String(s);
      return s.queryChunks.map((c: any) => {
        if (typeof c === 'string') return c;
        if (c && typeof c === 'object' && c.queryChunks) return flattenSql(c);
        if (c && typeof c === 'object' && c.value !== undefined) return `$${c.value}`;
        return String(c);
      }).join('');
    }

    it('should return sql`true` for empty filters', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, []);
      expect(flattenSql(result)).toContain('true');
    });

    it('should generate EXISTS subquery for eq operator', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'status', operator: 'eq', value: 'active' },
      ]);
      const sqlStr = flattenSql(result);
      expect(sqlStr).toContain('EXISTS');
      expect(sqlStr).toContain('entity_field_values');
      expect(sqlStr).toContain('value_text');
    });

    it('should generate neq condition', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'status', operator: 'neq', value: 'closed' },
      ]);
      const sqlStr = flattenSql(result);
      expect(sqlStr).toContain('EXISTS');
      expect(sqlStr).toContain('!=');
    });

    it('should generate gt condition for numbers', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'score', operator: 'gt', value: 80 },
      ]);
      expect(flattenSql(result)).toContain('value_number >');
    });

    it('should generate gte condition for numbers', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'score', operator: 'gte', value: 80 },
      ]);
      expect(flattenSql(result)).toContain('value_number >=');
    });

    it('should generate lt condition for numbers', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'score', operator: 'lt', value: 50 },
      ]);
      expect(flattenSql(result)).toContain('value_number <');
    });

    it('should generate lte condition for numbers', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'score', operator: 'lte', value: 50 },
      ]);
      expect(flattenSql(result)).toContain('value_number <=');
    });

    it('should generate ILIKE condition for like operator', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'name', operator: 'like', value: 'alice' },
      ]);
      expect(flattenSql(result)).toContain('ILIKE');
    });

    it('should generate jsonb ? condition for contains operator', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'tags', operator: 'contains', value: 'javascript' },
      ]);
      expect(flattenSql(result)).toContain('::jsonb');
    });

    it('should generate IN condition for in operator with array', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'status', operator: 'in', value: ['active', 'pending'] },
      ]);
      expect(flattenSql(result)).toContain('value_text IN');
    });

    it('should wrap single value in array for in operator', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'status', operator: 'in', value: 'active' },
      ]);
      expect(flattenSql(result)).toContain('value_text IN');
    });

    it('should fall back to eq-like behavior for unknown operators', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'status', operator: 'unknown_op' as any, value: 'active' },
      ]);
      expect(flattenSql(result)).toContain('value_text =');
    });

    it('should AND multiple filter conditions together', () => {
      const result = service.buildFilterCondition('candidates', entityIdCol, [
        { fieldKey: 'status', operator: 'eq', value: 'active' },
        { fieldKey: 'score', operator: 'gte', value: 80 },
      ]);
      const sqlStr = flattenSql(result);
      const existsCount = (sqlStr.match(/EXISTS/g) || []).length;
      expect(existsCount).toBe(2);
      expect(sqlStr).toContain(' AND ');
    });
  });
});
