import { describe, it, expect } from 'vitest';
import { buildConditions, isPayloadCondition, evaluatePayloadConditions, evaluateConditionsInMemory } from '../condition-builder';
import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import type { Condition } from '../../types';

// Fake table for testing
const testTable = pgTable('test', {
  id: text('id'),
  status: text('status'),
  priority: text('priority'),
  amount: integer('amount'),
});

describe('isPayloadCondition', () => {
  it('should return true for changed operator', () => {
    expect(isPayloadCondition({ field: 'status', operator: 'changed' })).toBe(true);
  });

  it('should return true for changed_to operator', () => {
    expect(isPayloadCondition({ field: 'status', operator: 'changed_to', value: 'active' })).toBe(true);
  });

  it('should return true for changed_from_to operator', () => {
    expect(isPayloadCondition({ field: 'status', operator: 'changed_from_to', value: { from: 'draft', to: 'active' } })).toBe(true);
  });

  it('should return false for eq operator', () => {
    expect(isPayloadCondition({ field: 'status', operator: 'eq', value: 'active' })).toBe(false);
  });

  it('should return false for neq operator', () => {
    expect(isPayloadCondition({ field: 'status', operator: 'neq', value: 'active' })).toBe(false);
  });

  it('should return false for gt operator', () => {
    expect(isPayloadCondition({ field: 'amount', operator: 'gt', value: 10 })).toBe(false);
  });

  it('should return false for lt operator', () => {
    expect(isPayloadCondition({ field: 'amount', operator: 'lt', value: 10 })).toBe(false);
  });

  it('should return false for in operator', () => {
    expect(isPayloadCondition({ field: 'status', operator: 'in', value: ['a', 'b'] })).toBe(false);
  });

  it('should return false for is_null operator', () => {
    expect(isPayloadCondition({ field: 'status', operator: 'is_null' })).toBe(false);
  });

  it('should return false for is_not_null operator', () => {
    expect(isPayloadCondition({ field: 'status', operator: 'is_not_null' })).toBe(false);
  });
});

describe('evaluatePayloadConditions', () => {
  describe('changed operator', () => {
    it('should return true when field is in changes array', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'changed' }];
      const payload = { changes: ['status', 'name'] };
      expect(evaluatePayloadConditions(conditions, payload)).toBe(true);
    });

    it('should return false when field is not in changes array', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'changed' }];
      const payload = { changes: ['name', 'email'] };
      expect(evaluatePayloadConditions(conditions, payload)).toBe(false);
    });
  });

  describe('changed_to operator', () => {
    it('should return true when field changed AND after value matches', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'changed_to', value: 'active' }];
      const payload = {
        changes: ['status'],
        after: { status: 'active' },
      };
      expect(evaluatePayloadConditions(conditions, payload)).toBe(true);
    });

    it('should return false when field changed but after value does not match', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'changed_to', value: 'active' }];
      const payload = {
        changes: ['status'],
        after: { status: 'inactive' },
      };
      expect(evaluatePayloadConditions(conditions, payload)).toBe(false);
    });

    it('should return false when field is not in changes', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'changed_to', value: 'active' }];
      const payload = {
        changes: ['name'],
        after: { status: 'active' },
      };
      expect(evaluatePayloadConditions(conditions, payload)).toBe(false);
    });
  });

  describe('changed_from_to operator', () => {
    it('should return true on exact from->to match', () => {
      const conditions: Condition[] = [{
        field: 'status',
        operator: 'changed_from_to',
        value: { from: 'draft', to: 'active' },
      }];
      const payload = {
        changes: ['status'],
        before: { status: 'draft' },
        after: { status: 'active' },
      };
      expect(evaluatePayloadConditions(conditions, payload)).toBe(true);
    });

    it('should return false when from does not match', () => {
      const conditions: Condition[] = [{
        field: 'status',
        operator: 'changed_from_to',
        value: { from: 'draft', to: 'active' },
      }];
      const payload = {
        changes: ['status'],
        before: { status: 'pending' },
        after: { status: 'active' },
      };
      expect(evaluatePayloadConditions(conditions, payload)).toBe(false);
    });

    it('should return false when to does not match', () => {
      const conditions: Condition[] = [{
        field: 'status',
        operator: 'changed_from_to',
        value: { from: 'draft', to: 'active' },
      }];
      const payload = {
        changes: ['status'],
        before: { status: 'draft' },
        after: { status: 'completed' },
      };
      expect(evaluatePayloadConditions(conditions, payload)).toBe(false);
    });

    it('should return false when field is not in changes', () => {
      const conditions: Condition[] = [{
        field: 'status',
        operator: 'changed_from_to',
        value: { from: 'draft', to: 'active' },
      }];
      const payload = {
        changes: ['name'],
        before: { status: 'draft' },
        after: { status: 'active' },
      };
      expect(evaluatePayloadConditions(conditions, payload)).toBe(false);
    });
  });

  it('should return true when there are no payload conditions', () => {
    const conditions: Condition[] = [{ field: 'status', operator: 'eq', value: 'active' }];
    const payload = { changes: [] };
    expect(evaluatePayloadConditions(conditions, payload)).toBe(true);
  });

  it('should return true for empty conditions array', () => {
    expect(evaluatePayloadConditions([], {})).toBe(true);
  });

  it('should return false when payload has no changes array', () => {
    const conditions: Condition[] = [{ field: 'status', operator: 'changed' }];
    expect(evaluatePayloadConditions(conditions, {})).toBe(false);
  });

  it('should work with EAV field names (custom fields)', () => {
    const conditions: Condition[] = [{ field: 'cf_priority_level', operator: 'changed' }];
    const payload = { changes: ['cf_priority_level', 'status'] };
    expect(evaluatePayloadConditions(conditions, payload)).toBe(true);
  });
});

describe('evaluateConditionsInMemory', () => {
  describe('eq operator', () => {
    it('should return true on exact match', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'eq', value: 'active' }];
      expect(evaluateConditionsInMemory(conditions, { status: 'active' })).toBe(true);
    });

    it('should return false on type mismatch', () => {
      const conditions: Condition[] = [{ field: 'amount', operator: 'eq', value: '10' }];
      expect(evaluateConditionsInMemory(conditions, { amount: 10 })).toBe(false);
    });

    it('should return false on value mismatch', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'eq', value: 'active' }];
      expect(evaluateConditionsInMemory(conditions, { status: 'inactive' })).toBe(false);
    });
  });

  describe('neq operator', () => {
    it('should return true when not equal', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'neq', value: 'active' }];
      expect(evaluateConditionsInMemory(conditions, { status: 'inactive' })).toBe(true);
    });

    it('should return false when equal', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'neq', value: 'active' }];
      expect(evaluateConditionsInMemory(conditions, { status: 'active' })).toBe(false);
    });
  });

  describe('gt operator', () => {
    it('should return true when value is greater', () => {
      const conditions: Condition[] = [{ field: 'amount', operator: 'gt', value: 10 }];
      expect(evaluateConditionsInMemory(conditions, { amount: 20 })).toBe(true);
    });

    it('should return false when value is equal', () => {
      const conditions: Condition[] = [{ field: 'amount', operator: 'gt', value: 10 }];
      expect(evaluateConditionsInMemory(conditions, { amount: 10 })).toBe(false);
    });

    it('should return false for non-numeric value', () => {
      const conditions: Condition[] = [{ field: 'amount', operator: 'gt', value: 10 }];
      expect(evaluateConditionsInMemory(conditions, { amount: 'twenty' })).toBe(false);
    });
  });

  describe('lt operator', () => {
    it('should return true when value is less', () => {
      const conditions: Condition[] = [{ field: 'amount', operator: 'lt', value: 10 }];
      expect(evaluateConditionsInMemory(conditions, { amount: 5 })).toBe(true);
    });

    it('should return false when value is equal', () => {
      const conditions: Condition[] = [{ field: 'amount', operator: 'lt', value: 10 }];
      expect(evaluateConditionsInMemory(conditions, { amount: 10 })).toBe(false);
    });

    it('should return false for non-numeric value', () => {
      const conditions: Condition[] = [{ field: 'amount', operator: 'lt', value: 10 }];
      expect(evaluateConditionsInMemory(conditions, { amount: 'five' })).toBe(false);
    });
  });

  describe('in operator', () => {
    it('should return true when value is in array', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'in', value: ['active', 'pending'] }];
      expect(evaluateConditionsInMemory(conditions, { status: 'active' })).toBe(true);
    });

    it('should return false when value is not in array', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'in', value: ['active', 'pending'] }];
      expect(evaluateConditionsInMemory(conditions, { status: 'closed' })).toBe(false);
    });
  });

  describe('is_null operator', () => {
    it('should return true when value is null', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'is_null' }];
      expect(evaluateConditionsInMemory(conditions, { status: null })).toBe(true);
    });

    it('should return true when value is undefined', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'is_null' }];
      expect(evaluateConditionsInMemory(conditions, {})).toBe(true);
    });

    it('should return false when value is present', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'is_null' }];
      expect(evaluateConditionsInMemory(conditions, { status: 'active' })).toBe(false);
    });
  });

  describe('is_not_null operator', () => {
    it('should return true when value is present', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'is_not_null' }];
      expect(evaluateConditionsInMemory(conditions, { status: 'active' })).toBe(true);
    });

    it('should return false when value is null', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'is_not_null' }];
      expect(evaluateConditionsInMemory(conditions, { status: null })).toBe(false);
    });

    it('should return false when value is undefined', () => {
      const conditions: Condition[] = [{ field: 'status', operator: 'is_not_null' }];
      expect(evaluateConditionsInMemory(conditions, {})).toBe(false);
    });
  });

  it('should return true for empty conditions array', () => {
    expect(evaluateConditionsInMemory([], { status: 'active' })).toBe(true);
  });

  it('should return true for unknown operator (does not block)', () => {
    // Force an unknown operator for testing
    const conditions = [{ field: 'status', operator: 'unknown_op' as any, value: 'x' }];
    expect(evaluateConditionsInMemory(conditions, { status: 'active' })).toBe(true);
  });

  it('should skip payload conditions and only evaluate state conditions', () => {
    const conditions: Condition[] = [
      { field: 'status', operator: 'changed' },
      { field: 'priority', operator: 'eq', value: 'high' },
    ];
    // The 'changed' condition should be filtered out; only eq is evaluated
    expect(evaluateConditionsInMemory(conditions, { priority: 'high' })).toBe(true);
    expect(evaluateConditionsInMemory(conditions, { priority: 'low' })).toBe(false);
  });
});

describe('buildConditions', () => {
  const allowedFields = ['status', 'priority', 'amount'];

  it('should build eq condition', () => {
    const result = buildConditions(testTable, [
      { field: 'status', operator: 'eq', value: 'pending' },
    ], allowedFields);

    expect(result).toHaveLength(1);
  });

  it('should build neq condition', () => {
    const result = buildConditions(testTable, [
      { field: 'status', operator: 'neq', value: 'completed' },
    ], allowedFields);

    expect(result).toHaveLength(1);
  });

  it('should build in condition with array value', () => {
    const result = buildConditions(testTable, [
      { field: 'priority', operator: 'in', value: ['high', 'critical'] },
    ], allowedFields);

    expect(result).toHaveLength(1);
  });

  it('should build gt and lt conditions', () => {
    const result = buildConditions(testTable, [
      { field: 'amount', operator: 'gt', value: 100 },
      { field: 'amount', operator: 'lt', value: 1000 },
    ], allowedFields);

    expect(result).toHaveLength(2);
  });

  it('should build is_null and is_not_null conditions', () => {
    const result = buildConditions(testTable, [
      { field: 'status', operator: 'is_null' },
      { field: 'priority', operator: 'is_not_null' },
    ], allowedFields);

    expect(result).toHaveLength(2);
  });

  it('should skip fields not in allowed list', () => {
    const result = buildConditions(testTable, [
      { field: 'unknown_field', operator: 'eq', value: 'test' },
      { field: 'status', operator: 'eq', value: 'pending' },
    ], allowedFields);

    expect(result).toHaveLength(1);
  });

  it('should skip in operator with non-array value', () => {
    const result = buildConditions(testTable, [
      { field: 'status', operator: 'in', value: 'not-an-array' },
    ], allowedFields);

    expect(result).toHaveLength(0);
  });

  it('should handle multiple conditions', () => {
    const result = buildConditions(testTable, [
      { field: 'status', operator: 'eq', value: 'pending' },
      { field: 'priority', operator: 'in', value: ['high'] },
      { field: 'amount', operator: 'gt', value: 0 },
    ], allowedFields);

    expect(result).toHaveLength(3);
  });

  it('should return empty array for empty conditions', () => {
    const result = buildConditions(testTable, [], allowedFields);
    expect(result).toHaveLength(0);
  });

  it('should filter out payload operators (changed, changed_to, changed_from_to)', () => {
    const result = buildConditions(testTable, [
      { field: 'status', operator: 'changed' },
      { field: 'status', operator: 'changed_to', value: 'active' },
      { field: 'status', operator: 'changed_from_to', value: { from: 'draft', to: 'active' } },
      { field: 'status', operator: 'eq', value: 'pending' },
    ], allowedFields);

    // Only the eq condition should produce SQL
    expect(result).toHaveLength(1);
  });

  it('should return empty array when all conditions are payload operators', () => {
    const result = buildConditions(testTable, [
      { field: 'status', operator: 'changed' },
      { field: 'status', operator: 'changed_to', value: 'active' },
    ], allowedFields);

    expect(result).toHaveLength(0);
  });
});
