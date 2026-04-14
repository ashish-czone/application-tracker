import { describe, it, expect } from 'vitest';
import { buildHierarchyRows } from '../buildHierarchyRows';

type Row = { id: string; parentId: string | null; name: string };

const mk = (id: string, parentId: string | null, name = id): Row => ({ id, parentId, name });

describe('buildHierarchyRows', () => {
  it('returns an empty array for no input', () => {
    expect(buildHierarchyRows([], new Set())).toEqual([]);
  });

  it('emits a single depth-0 row for a flat list of roots', () => {
    const rows = buildHierarchyRows([mk('a', null), mk('b', null)], new Set());
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => [r.id, r.depth])).toEqual([['a', 0], ['b', 0]]);
    expect(rows.every((r) => !r.hasChildren)).toBe(true);
  });

  it('walks a nested chain depth-first and increments depth', () => {
    const rows = buildHierarchyRows(
      [mk('root', null), mk('child', 'root'), mk('grand', 'child')],
      new Set(),
    );
    expect(rows.map((r) => [r.id, r.depth])).toEqual([
      ['root', 0],
      ['child', 1],
      ['grand', 2],
    ]);
  });

  it('marks nodes with children', () => {
    const rows = buildHierarchyRows([mk('a', null), mk('b', 'a')], new Set());
    expect(rows.find((r) => r.id === 'a')?.hasChildren).toBe(true);
    expect(rows.find((r) => r.id === 'b')?.hasChildren).toBe(false);
  });

  it('skips descendants of collapsed nodes (but keeps the collapsed node itself)', () => {
    const rows = buildHierarchyRows(
      [mk('root', null), mk('child', 'root'), mk('grand', 'child'), mk('sibling', null)],
      new Set(['root']),
    );
    expect(rows.map((r) => r.id)).toEqual(['root', 'sibling']);
    const rootRow = rows.find((r) => r.id === 'root')!;
    expect(rootRow.collapsed).toBe(true);
    expect(rootRow.hasChildren).toBe(true);
  });

  it('precomputes descendantIds for every row', () => {
    const rows = buildHierarchyRows(
      [mk('root', null), mk('c1', 'root'), mk('c2', 'root'), mk('g', 'c1')],
      new Set(),
    );
    const root = rows.find((r) => r.id === 'root')!;
    expect([...root.descendantIds].sort()).toEqual(['c1', 'c2', 'g']);
    const c1 = rows.find((r) => r.id === 'c1')!;
    expect([...c1.descendantIds]).toEqual(['g']);
    const c2 = rows.find((r) => r.id === 'c2')!;
    expect(c2.descendantIds.size).toBe(0);
  });

  it('treats rows whose parentId is not in the list as roots', () => {
    // Useful for partial trees: if a parent is filtered out, its children
    // float up rather than disappearing.
    const rows = buildHierarchyRows([mk('orphan', 'missing-parent')], new Set());
    expect(rows.map((r) => [r.id, r.depth])).toEqual([['orphan', 0]]);
  });

  it('preserves the original item on each row', () => {
    const input = [mk('a', null, 'Alpha')];
    const rows = buildHierarchyRows(input, new Set());
    expect(rows[0].item).toBe(input[0]);
  });
});
