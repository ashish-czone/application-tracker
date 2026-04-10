import { describe, it, expect } from 'vitest';
import { buildTree, flattenTree } from '../tree';

interface Item {
  id: string;
  parentId: string | null;
  name: string;
}

describe('buildTree', () => {
  it('returns empty array for empty input', () => {
    expect(buildTree([])).toEqual([]);
  });

  it('returns single root node', () => {
    const items: Item[] = [{ id: '1', parentId: null, name: 'Root' }];
    const tree = buildTree(items);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('1');
    expect(tree[0].children).toEqual([]);
  });

  it('builds parent-child relationships', () => {
    const items: Item[] = [
      { id: '1', parentId: null, name: 'Root' },
      { id: '2', parentId: '1', name: 'Child' },
    ];
    const tree = buildTree(items);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('2');
  });

  it('builds multi-level trees', () => {
    const items: Item[] = [
      { id: '1', parentId: null, name: 'Root' },
      { id: '2', parentId: '1', name: 'Child' },
      { id: '3', parentId: '2', name: 'Grandchild' },
    ];
    const tree = buildTree(items);

    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].id).toBe('3');
  });

  it('handles multiple roots', () => {
    const items: Item[] = [
      { id: '1', parentId: null, name: 'Root A' },
      { id: '2', parentId: null, name: 'Root B' },
      { id: '3', parentId: '1', name: 'Child of A' },
    ];
    const tree = buildTree(items);

    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[1].children).toHaveLength(0);
  });

  it('treats items with missing parents as roots', () => {
    const items: Item[] = [
      { id: '2', parentId: 'missing', name: 'Orphan' },
    ];
    const tree = buildTree(items);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('2');
  });

  it('handles multiple children per parent', () => {
    const items: Item[] = [
      { id: '1', parentId: null, name: 'Root' },
      { id: '2', parentId: '1', name: 'Child A' },
      { id: '3', parentId: '1', name: 'Child B' },
      { id: '4', parentId: '1', name: 'Child C' },
    ];
    const tree = buildTree(items);

    expect(tree[0].children).toHaveLength(3);
  });
});

describe('flattenTree', () => {
  it('returns empty array for empty input', () => {
    expect(flattenTree([])).toEqual([]);
  });

  it('flattens a tree in depth-first pre-order', () => {
    const items: Item[] = [
      { id: '1', parentId: null, name: 'Root' },
      { id: '2', parentId: '1', name: 'Child A' },
      { id: '3', parentId: '2', name: 'Grandchild' },
      { id: '4', parentId: '1', name: 'Child B' },
    ];
    const tree = buildTree(items);
    const flat = flattenTree(tree);

    expect(flat.map(n => n.id)).toEqual(['1', '2', '3', '4']);
  });
});