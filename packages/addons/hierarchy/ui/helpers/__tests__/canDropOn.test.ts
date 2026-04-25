import { describe, it, expect } from 'vitest';
import { buildHierarchyRows } from '../buildHierarchyRows';
import { canDropOn } from '../canDropOn';

const tree = buildHierarchyRows(
  [
    { id: 'root', parentId: null },
    { id: 'a', parentId: 'root' },
    { id: 'a1', parentId: 'a' },
    { id: 'b', parentId: 'root' },
    { id: 'other', parentId: null },
  ],
  new Set(),
);

describe('canDropOn', () => {
  it('rejects dropping onto itself', () => {
    expect(canDropOn('a', 'a', tree)).toBe(false);
  });

  it('rejects dropping onto a direct descendant', () => {
    expect(canDropOn('a', 'a1', tree)).toBe(false);
  });

  it('rejects dropping onto a deeper descendant', () => {
    expect(canDropOn('root', 'a1', tree)).toBe(false);
  });

  it('allows dropping onto a sibling', () => {
    expect(canDropOn('a', 'b', tree)).toBe(true);
  });

  it('allows dropping onto an unrelated root', () => {
    expect(canDropOn('a', 'other', tree)).toBe(true);
  });

  it('allows dropping onto the current parent (backend treats it as a no-op)', () => {
    expect(canDropOn('a', 'root', tree)).toBe(true);
  });

  it('allows dropping onto the root (null target)', () => {
    expect(canDropOn('a', null, tree)).toBe(true);
  });

  it('rejects when the source id is unknown', () => {
    expect(canDropOn('ghost', 'root', tree)).toBe(false);
  });
});
