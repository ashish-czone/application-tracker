import { describe, it, expect } from 'vitest';
import { buildConditions } from '../condition-builder';
import { pgTable, text, integer } from 'drizzle-orm/pg-core';

// Fake table for testing
const testTable = pgTable('test', {
  id: text('id'),
  status: text('status'),
  priority: text('priority'),
  amount: integer('amount'),
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
