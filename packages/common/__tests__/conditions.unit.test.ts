import { describe, it, expect } from 'vitest';
import { isPayloadCondition, evaluatePayloadConditions, evaluateConditionsInMemory } from '../conditions';
import type { Condition } from '../conditions';

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
    const conditions = [{ field: 'status', operator: 'unknown_op' as any, value: 'x' }];
    expect(evaluateConditionsInMemory(conditions, { status: 'active' })).toBe(true);
  });

  it('should skip payload conditions and only evaluate state conditions', () => {
    const conditions: Condition[] = [
      { field: 'status', operator: 'changed' },
      { field: 'priority', operator: 'eq', value: 'high' },
    ];
    expect(evaluateConditionsInMemory(conditions, { priority: 'high' })).toBe(true);
    expect(evaluateConditionsInMemory(conditions, { priority: 'low' })).toBe(false);
  });
});
