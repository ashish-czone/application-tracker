import { describe, it, expect } from 'vitest';
import { buildSnapshot, diffSnapshot } from '../snapshot';

describe('buildSnapshot', () => {
  it('should merge standard fields and EAV values', () => {
    const standard = { firstName: 'Alice', email: 'alice@test.com' };
    const eav = { customField: 'value', rating: 5 };

    const result = buildSnapshot(standard, eav);

    expect(result).toEqual({
      firstName: 'Alice',
      email: 'alice@test.com',
      customField: 'value',
      rating: 5,
    });
  });

  it('should give standard fields precedence over EAV on key collision', () => {
    const standard = { name: 'Standard Name', email: 'std@test.com' };
    const eav = { name: 'EAV Name', customField: 'value' };

    const result = buildSnapshot(standard, eav);

    expect(result.name).toBe('Standard Name');
    expect(result.customField).toBe('value');
    expect(result.email).toBe('std@test.com');
  });

  it('should return empty object when both inputs are empty', () => {
    const result = buildSnapshot({}, {});
    expect(result).toEqual({});
  });

  it('should handle null values in standard fields', () => {
    const standard = { firstName: null, email: 'test@test.com' };
    const eav = { customField: 'value' };

    const result = buildSnapshot(standard, eav);

    expect(result.firstName).toBeNull();
    expect(result.customField).toBe('value');
  });

  it('should handle only standard fields (no EAV)', () => {
    const standard = { firstName: 'Alice' };
    const result = buildSnapshot(standard, {});
    expect(result).toEqual({ firstName: 'Alice' });
  });

  it('should handle only EAV fields (no standard)', () => {
    const eav = { customField: 'value' };
    const result = buildSnapshot({}, eav);
    expect(result).toEqual({ customField: 'value' });
  });
});

describe('diffSnapshot', () => {
  it('should return empty array when snapshots are identical', () => {
    const snapshot = { firstName: 'Alice', age: 30, active: true };
    const result = diffSnapshot(snapshot, { ...snapshot });
    expect(result).toEqual([]);
  });

  it('should detect changed primitive values', () => {
    const before = { firstName: 'Alice', lastName: 'Smith' };
    const after = { firstName: 'Bob', lastName: 'Smith' };

    const result = diffSnapshot(before, after);

    expect(result).toEqual(['firstName']);
  });

  it('should detect multiple changed fields', () => {
    const before = { firstName: 'Alice', lastName: 'Smith', age: 30 };
    const after = { firstName: 'Bob', lastName: 'Jones', age: 30 };

    const result = diffSnapshot(before, after);

    expect(result).toContain('firstName');
    expect(result).toContain('lastName');
    expect(result).not.toContain('age');
  });

  it('should detect new keys in after snapshot', () => {
    const before = { firstName: 'Alice' };
    const after = { firstName: 'Alice', newField: 'value' };

    const result = diffSnapshot(before, after);

    expect(result).toEqual(['newField']);
  });

  it('should detect removed keys (present in before, missing in after)', () => {
    const before = { firstName: 'Alice', removedField: 'value' };
    const after = { firstName: 'Alice' };

    const result = diffSnapshot(before, after);

    expect(result).toEqual(['removedField']);
  });

  it('should detect null vs undefined as a change', () => {
    const before = { field: null } as Record<string, unknown>;
    const after = { field: undefined } as Record<string, unknown>;

    const result = diffSnapshot(before, after);

    expect(result).toEqual(['field']);
  });

  it('should handle Date comparison correctly', () => {
    const date1 = new Date('2024-01-15T10:00:00Z');
    const date2 = new Date('2024-01-15T10:00:00Z');
    const date3 = new Date('2024-06-01T10:00:00Z');

    // Same dates
    expect(diffSnapshot({ d: date1 }, { d: date2 })).toEqual([]);

    // Different dates
    expect(diffSnapshot({ d: date1 }, { d: date3 })).toEqual(['d']);
  });

  it('should handle array comparison correctly', () => {
    // Same arrays
    expect(diffSnapshot(
      { tags: ['a', 'b'] },
      { tags: ['a', 'b'] },
    )).toEqual([]);

    // Different arrays
    expect(diffSnapshot(
      { tags: ['a', 'b'] },
      { tags: ['a', 'c'] },
    )).toEqual(['tags']);
  });

  it('should handle both snapshots being empty', () => {
    const result = diffSnapshot({}, {});
    expect(result).toEqual([]);
  });

  it('should handle number vs string difference', () => {
    const before = { age: 30 } as Record<string, unknown>;
    const after = { age: '30' } as Record<string, unknown>;

    const result = diffSnapshot(before, after);

    expect(result).toEqual(['age']);
  });
});
