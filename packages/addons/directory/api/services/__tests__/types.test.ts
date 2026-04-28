import { describe, expect, it } from 'vitest';
import { followMerged, isUniqueViolation } from '../types';

describe('isUniqueViolation', () => {
  it('returns true for code 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('returns false for other codes', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });
});

describe('followMerged', () => {
  type Row = { id: string; mergedIntoId: string | null };

  it('returns the row as-is when not merged', async () => {
    const row: Row = { id: 'a', mergedIntoId: null };
    const result = await followMerged(row, async () => null);
    expect(result.id).toBe('a');
  });

  it('chases a single redirect', async () => {
    const a: Row = { id: 'a', mergedIntoId: 'b' };
    const b: Row = { id: 'b', mergedIntoId: null };
    const result = await followMerged(a, async (id) => (id === 'b' ? b : null));
    expect(result.id).toBe('b');
  });

  it('chases a multi-hop redirect', async () => {
    const rows: Record<string, Row> = {
      a: { id: 'a', mergedIntoId: 'b' },
      b: { id: 'b', mergedIntoId: 'c' },
      c: { id: 'c', mergedIntoId: null },
    };
    const result = await followMerged(rows.a!, async (id) => rows[id] ?? null);
    expect(result.id).toBe('c');
  });

  it('returns the last reachable row when a redirect target is missing', async () => {
    const a: Row = { id: 'a', mergedIntoId: 'b' };
    const result = await followMerged(a, async () => null);
    expect(result.id).toBe('a');
  });

  it('throws if the chain exceeds max depth', async () => {
    const rows = new Map<string, Row>();
    for (let i = 0; i < 20; i += 1) {
      rows.set(`r${i}`, { id: `r${i}`, mergedIntoId: `r${i + 1}` });
    }
    const start = rows.get('r0')!;
    await expect(
      followMerged(start, async (id) => rows.get(id) ?? null),
    ).rejects.toThrow(/merge chain exceeded/);
  });
});
