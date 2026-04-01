import { describe, it, expect } from 'vitest';
import { coerceFieldValues } from '../coerce-field-values';

describe('coerceFieldValues', () => {
  it('should extract date from datetime string', () => {
    const result = coerceFieldValues(
      { dueDate: '2026-04-06 10:00:00+00' },
      { dueDate: 'date' },
    );
    expect(result.dueDate).toBe('2026-04-06');
  });

  it('should extract date from ISO datetime string', () => {
    const result = coerceFieldValues(
      { dueDate: '2026-04-06T10:00:00.000Z' },
      { dueDate: 'date' },
    );
    expect(result.dueDate).toBe('2026-04-06');
  });

  it('should pass through already-valid date strings', () => {
    const result = coerceFieldValues(
      { dueDate: '2026-04-06' },
      { dueDate: 'date' },
    );
    expect(result.dueDate).toBe('2026-04-06');
  });

  it('should normalize postgres datetime to ISO', () => {
    const result = coerceFieldValues(
      { startAt: '2026-04-06 10:00:00+00' },
      { startAt: 'datetime' },
    );
    expect(result.startAt).toBe('2026-04-06T10:00:00.000Z');
  });

  it('should pass through ISO datetime unchanged', () => {
    const result = coerceFieldValues(
      { startAt: '2026-04-06T10:00:00.000Z' },
      { startAt: 'datetime' },
    );
    expect(result.startAt).toBe('2026-04-06T10:00:00.000Z');
  });

  it('should coerce string numbers to numbers', () => {
    const result = coerceFieldValues(
      { amount: '12550', rate: '3.14', count: '42' },
      { amount: 'currency', rate: 'decimal', count: 'number' },
    );
    expect(result.amount).toBe(12550);
    expect(result.rate).toBe(3.14);
    expect(result.count).toBe(42);
  });

  it('should leave non-numeric strings as-is for number fields', () => {
    const result = coerceFieldValues(
      { count: 'abc' },
      { count: 'number' },
    );
    expect(result.count).toBe('abc');
  });

  it('should coerce string booleans', () => {
    const result = coerceFieldValues(
      { active: 'true', archived: 'false' },
      { active: 'boolean', archived: 'boolean' },
    );
    expect(result.active).toBe(true);
    expect(result.archived).toBe(false);
  });

  it('should leave non-boolean strings as-is for boolean fields', () => {
    const result = coerceFieldValues(
      { active: 'yes' },
      { active: 'boolean' },
    );
    expect(result.active).toBe('yes');
  });

  it('should pass through text fields unchanged', () => {
    const result = coerceFieldValues(
      { title: 'Hello world' },
      { title: 'text' },
    );
    expect(result.title).toBe('Hello world');
  });

  it('should skip non-string values', () => {
    const result = coerceFieldValues(
      { count: 42, active: true },
      { count: 'number', active: 'boolean' },
    );
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });

  it('should skip fields not in the type map', () => {
    const result = coerceFieldValues(
      { unknown: '2026-04-06 10:00:00+00' },
      {},
    );
    expect(result.unknown).toBe('2026-04-06 10:00:00+00');
  });
});
