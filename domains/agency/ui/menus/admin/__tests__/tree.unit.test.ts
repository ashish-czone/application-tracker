import { describe, it, expect } from 'vitest';
import { buildMenuItemTree, computeSortOrderForIndex } from '../tree';
import type { MenuItemRecord } from '../types';

function item(overrides: Partial<MenuItemRecord>): MenuItemRecord {
  return {
    id: overrides.id ?? 'x',
    menuId: overrides.menuId ?? 'm1',
    label: overrides.label ?? 'Item',
    linkType: overrides.linkType ?? 'url',
    url: overrides.url ?? null,
    pageId: overrides.pageId ?? null,
    target: overrides.target ?? '_self',
    parentId: overrides.parentId ?? null,
    depth: overrides.depth ?? 0,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
  };
}

describe('buildMenuItemTree', () => {
  it('returns [] for no items', () => {
    expect(buildMenuItemTree([])).toEqual([]);
  });

  it('sorts roots and children by sortOrder', () => {
    const tree = buildMenuItemTree([
      item({ id: 'a', sortOrder: 200 }),
      item({ id: 'b', sortOrder: 100 }),
      item({ id: 'a2', parentId: 'a', depth: 1, sortOrder: 20 }),
      item({ id: 'a1', parentId: 'a', depth: 1, sortOrder: 10 }),
    ]);
    expect(tree.map((n) => n.id)).toEqual(['b', 'a']);
    expect(tree[1].children.map((c) => c.id)).toEqual(['a1', 'a2']);
  });

  it('surfaces orphans at root', () => {
    const tree = buildMenuItemTree([item({ id: 'x', parentId: 'missing', depth: 1 })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('x');
  });
});

describe('computeSortOrderForIndex', () => {
  const siblings = [
    { id: 'a', sortOrder: 1000 },
    { id: 'b', sortOrder: 2000 },
    { id: 'c', sortOrder: 3000 },
  ];

  it('returns a midpoint when inserting between existing siblings', () => {
    expect(computeSortOrderForIndex(siblings, 1)).toBe(1500);
    expect(computeSortOrderForIndex(siblings, 2)).toBe(2500);
  });

  it('returns prev + 1000 when appending', () => {
    expect(computeSortOrderForIndex(siblings, 3)).toBe(4000);
  });

  it('returns next - 1000 when prepending', () => {
    expect(computeSortOrderForIndex(siblings, 0)).toBe(0);
  });

  it('returns 1000 for an empty list', () => {
    expect(computeSortOrderForIndex([], 0)).toBe(1000);
  });

  it('excludes the moving item when computing the target slot', () => {
    // If we move 'a' (sortOrder 1000) to index 1, the remaining siblings
    // are b/c and the slot "1" sits between b and c → midpoint 2500.
    expect(computeSortOrderForIndex(siblings, 1, 'a')).toBe(2500);
  });
});
