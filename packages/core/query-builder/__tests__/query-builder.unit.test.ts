import { describe, it, expect } from 'vitest';
import {
  buildFilterCondition,
  buildFilterConditions,
  buildSearchCondition,
  buildSoftDeleteCondition,
  buildSortExpression,
  computePagination,
  computePaginationMeta,
  parseLegacyFilters,
  parseFilterParam,
  mergeFilters,
} from '../query-builder';
import { OPERATORS_BY_FIELD_TYPE } from '../types';
import type { FilterExpression } from '../types';

// ---------------------------------------------------------------------------
// computePagination
// ---------------------------------------------------------------------------
describe('computePagination', () => {
  it('computes offset for page 1', () => {
    const result = computePagination({ page: 1, limit: 25 });
    expect(result).toEqual({ page: 1, limit: 25, offset: 0 });
  });

  it('computes offset for page 3 with limit 10', () => {
    const result = computePagination({ page: 3, limit: 10 });
    expect(result).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('clamps page to minimum 1', () => {
    const result = computePagination({ page: 0, limit: 25 });
    expect(result.page).toBe(1);
    expect(result.offset).toBe(0);
  });

  it('clamps limit to minimum 1', () => {
    const result = computePagination({ page: 1, limit: 0 });
    expect(result.limit).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computePaginationMeta
// ---------------------------------------------------------------------------
describe('computePaginationMeta', () => {
  it('computes correct totalPages with exact division', () => {
    const meta = computePaginationMeta(100, 1, 25);
    expect(meta).toEqual({ total: 100, page: 1, limit: 25, totalPages: 4 });
  });

  it('computes correct totalPages with remainder', () => {
    const meta = computePaginationMeta(101, 1, 25);
    expect(meta.totalPages).toBe(5);
  });

  it('handles zero total', () => {
    const meta = computePaginationMeta(0, 1, 25);
    expect(meta.totalPages).toBe(0);
  });

  it('handles zero limit', () => {
    const meta = computePaginationMeta(10, 1, 0);
    expect(meta.totalPages).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseLegacyFilters
// ---------------------------------------------------------------------------
describe('parseLegacyFilters', () => {
  it('converts key=value to eq FilterExpression', () => {
    const result = parseLegacyFilters({ status: 'active' });
    expect(result).toEqual([{ field: 'status', operator: 'eq', value: 'active' }]);
  });

  it('strips system params', () => {
    const result = parseLegacyFilters({
      page: 1,
      limit: 25,
      search: 'test',
      sort: 'name',
      order: 'asc',
      includeDeleted: false,
      filters: '[]',
      status: 'active',
    });
    expect(result).toEqual([{ field: 'status', operator: 'eq', value: 'active' }]);
  });

  it('ignores null, undefined, and empty string values', () => {
    const result = parseLegacyFilters({ a: null, b: undefined, c: '', d: 'valid' });
    expect(result).toEqual([{ field: 'd', operator: 'eq', value: 'valid' }]);
  });

  it('handles multiple filters', () => {
    const result = parseLegacyFilters({ status: 'active', department: 'sales' });
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.field).sort()).toEqual(['department', 'status']);
  });

  it('returns empty array for no filters', () => {
    const result = parseLegacyFilters({ page: 1, limit: 25 });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseFilterParam
// ---------------------------------------------------------------------------
describe('parseFilterParam', () => {
  it('parses valid JSON array of FilterExpressions', () => {
    const input = JSON.stringify([
      { field: 'status', operator: 'eq', value: 'active' },
      { field: 'age', operator: 'gte', value: 18 },
    ]);
    const result = parseFilterParam(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ field: 'status', operator: 'eq', value: 'active' });
    expect(result[1]).toEqual({ field: 'age', operator: 'gte', value: 18 });
  });

  it('returns empty array for invalid JSON', () => {
    expect(parseFilterParam('not json')).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    expect(parseFilterParam('{"field":"status"}')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseFilterParam('')).toEqual([]);
  });

  it('filters out entries with missing field', () => {
    const input = JSON.stringify([
      { operator: 'eq', value: 'active' },
      { field: 'status', operator: 'eq', value: 'active' },
    ]);
    const result = parseFilterParam(input);
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('status');
  });

  it('filters out entries with invalid operator', () => {
    const input = JSON.stringify([
      { field: 'status', operator: 'INVALID', value: 'active' },
      { field: 'age', operator: 'gte', value: 18 },
    ]);
    const result = parseFilterParam(input);
    expect(result).toHaveLength(1);
    expect(result[0].field).toBe('age');
  });

  it('parses empty array', () => {
    expect(parseFilterParam('[]')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mergeFilters
// ---------------------------------------------------------------------------
describe('mergeFilters', () => {
  it('returns legacy when no structured filters', () => {
    const legacy: FilterExpression[] = [{ field: 'status', operator: 'eq', value: 'active' }];
    expect(mergeFilters(legacy, [])).toEqual(legacy);
  });

  it('returns structured when no legacy filters', () => {
    const structured: FilterExpression[] = [{ field: 'status', operator: 'in', value: ['a', 'b'] }];
    expect(mergeFilters([], structured)).toEqual(structured);
  });

  it('structured takes precedence for same field', () => {
    const legacy: FilterExpression[] = [{ field: 'status', operator: 'eq', value: 'active' }];
    const structured: FilterExpression[] = [{ field: 'status', operator: 'in', value: ['a', 'b'] }];
    const result = mergeFilters(legacy, structured);
    expect(result).toHaveLength(1);
    expect(result[0].operator).toBe('in');
  });

  it('combines non-overlapping filters', () => {
    const legacy: FilterExpression[] = [{ field: 'status', operator: 'eq', value: 'active' }];
    const structured: FilterExpression[] = [{ field: 'age', operator: 'gte', value: 18 }];
    const result = mergeFilters(legacy, structured);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// buildFilterCondition — Drizzle SQL output tests
// ---------------------------------------------------------------------------
describe('buildFilterCondition', () => {
  // We use a mock column object. Drizzle's eq/ne/etc. accept any column-like object.
  // We verify the function doesn't throw and returns a truthy SQL object.
  const mockColumn = { name: 'status' } as any;

  it.each<[string, FilterExpression]>([
    ['eq', { field: 'status', operator: 'eq', value: 'active' }],
    ['neq', { field: 'status', operator: 'neq', value: 'active' }],
    ['gt', { field: 'age', operator: 'gt', value: 18 }],
    ['gte', { field: 'age', operator: 'gte', value: 18 }],
    ['lt', { field: 'age', operator: 'lt', value: 65 }],
    ['lte', { field: 'age', operator: 'lte', value: 65 }],
    ['like', { field: 'name', operator: 'like', value: 'john' }],
    ['in', { field: 'status', operator: 'in', value: ['a', 'b'] }],
    ['notIn', { field: 'status', operator: 'notIn', value: ['a', 'b'] }],
    ['isNull', { field: 'status', operator: 'isNull', value: null }],
    ['isNotNull', { field: 'status', operator: 'isNotNull', value: null }],
    ['between', { field: 'age', operator: 'between', value: [18, 65] }],
    ['contains', { field: 'tags', operator: 'contains', value: 'important' }],
  ])('handles %s operator without throwing', (_label, expr) => {
    expect(() => buildFilterCondition(mockColumn, expr)).not.toThrow();
    const result = buildFilterCondition(mockColumn, expr);
    expect(result).toBeTruthy();
  });

  it('falls back to eq for unknown operator', () => {
    const expr = { field: 'x', operator: 'unknown' as any, value: 'v' };
    expect(() => buildFilterCondition(mockColumn, expr)).not.toThrow();
  });

  it('handles in operator with single value (non-array)', () => {
    const expr: FilterExpression = { field: 'status', operator: 'in', value: 'active' };
    expect(() => buildFilterCondition(mockColumn, expr)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildFilterConditions
// ---------------------------------------------------------------------------
describe('buildFilterConditions', () => {
  const columnMap = {
    status: { name: 'status' } as any,
    age: { name: 'age' } as any,
  };

  it('resolves known fields to conditions', () => {
    const filters: FilterExpression[] = [
      { field: 'status', operator: 'eq', value: 'active' },
      { field: 'age', operator: 'gte', value: 18 },
    ];
    const { conditions, unresolved } = buildFilterConditions(filters, columnMap);
    expect(conditions).toHaveLength(2);
    expect(unresolved).toHaveLength(0);
  });

  it('returns unresolved for unknown fields', () => {
    const filters: FilterExpression[] = [
      { field: 'status', operator: 'eq', value: 'active' },
      { field: 'customEavField', operator: 'like', value: 'test' },
    ];
    const { conditions, unresolved } = buildFilterConditions(filters, columnMap);
    expect(conditions).toHaveLength(1);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].field).toBe('customEavField');
  });

  it('handles empty filter array', () => {
    const { conditions, unresolved } = buildFilterConditions([], columnMap);
    expect(conditions).toHaveLength(0);
    expect(unresolved).toHaveLength(0);
  });

  it('handles all unresolved', () => {
    const filters: FilterExpression[] = [
      { field: 'unknown1', operator: 'eq', value: 'a' },
      { field: 'unknown2', operator: 'eq', value: 'b' },
    ];
    const { conditions, unresolved } = buildFilterConditions(filters, columnMap);
    expect(conditions).toHaveLength(0);
    expect(unresolved).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// buildSearchCondition
// ---------------------------------------------------------------------------
describe('buildSearchCondition', () => {
  const col1 = { name: 'first_name' } as any;
  const col2 = { name: 'last_name' } as any;

  it('returns null for empty term', () => {
    expect(buildSearchCondition('', [col1])).toBeNull();
  });

  it('returns null for empty columns', () => {
    expect(buildSearchCondition('test', [])).toBeNull();
  });

  it('returns a condition for single column', () => {
    const result = buildSearchCondition('john', [col1]);
    expect(result).toBeTruthy();
  });

  it('returns a condition for multiple columns', () => {
    const result = buildSearchCondition('john', [col1, col2]);
    expect(result).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// buildSoftDeleteCondition
// ---------------------------------------------------------------------------
describe('buildSoftDeleteCondition', () => {
  const deletedAtCol = { name: 'deleted_at' } as any;

  it('returns IS NULL condition when not including deleted', () => {
    const result = buildSoftDeleteCondition(deletedAtCol, false);
    expect(result).toBeTruthy();
  });

  it('returns null when including deleted', () => {
    expect(buildSoftDeleteCondition(deletedAtCol, true)).toBeNull();
  });

  it('returns null when no deletedAt column', () => {
    expect(buildSoftDeleteCondition(undefined, false)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildSortExpression
// ---------------------------------------------------------------------------
describe('buildSortExpression', () => {
  const sortable = {
    name: { name: 'name' } as any,
    createdAt: { name: 'created_at' } as any,
  };

  it('returns sort expression for known key', () => {
    const result = buildSortExpression('name', 'asc', sortable, 'createdAt');
    expect(result).toBeTruthy();
  });

  it('falls back to default sort for unknown key', () => {
    const result = buildSortExpression('unknown', 'desc', sortable, 'createdAt');
    expect(result).toBeTruthy();
  });

  it('returns undefined when neither key nor default exist', () => {
    const result = buildSortExpression('unknown', 'asc', {}, 'alsoUnknown');
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// OPERATORS_BY_FIELD_TYPE
// ---------------------------------------------------------------------------
describe('OPERATORS_BY_FIELD_TYPE', () => {
  it('every field type has at least one operator', () => {
    for (const [type, ops] of Object.entries(OPERATORS_BY_FIELD_TYPE)) {
      expect(ops.length, `${type} should have operators`).toBeGreaterThan(0);
    }
  });

  it('number types include comparison operators', () => {
    for (const type of ['number', 'currency', 'decimal']) {
      const ops = OPERATORS_BY_FIELD_TYPE[type];
      expect(ops).toContain('gt');
      expect(ops).toContain('lt');
      expect(ops).toContain('between');
    }
  });

  it('text types include like', () => {
    for (const type of ['text', 'email', 'phone', 'url']) {
      expect(OPERATORS_BY_FIELD_TYPE[type]).toContain('like');
    }
  });

  it('picklist/lookup types include in', () => {
    for (const type of ['picklist', 'lookup', 'user']) {
      expect(OPERATORS_BY_FIELD_TYPE[type]).toContain('in');
    }
  });

  it('date types include between', () => {
    for (const type of ['date', 'datetime']) {
      expect(OPERATORS_BY_FIELD_TYPE[type]).toContain('between');
    }
  });
});
