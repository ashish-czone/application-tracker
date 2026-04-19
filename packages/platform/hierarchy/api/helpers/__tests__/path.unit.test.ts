import { describe, it, expect } from 'vitest';
import {
  computePath,
  computeDepth,
  extractAncestorIds,
  extractNodeId,
  rebasePath,
  isDescendantOf,
  descendantPrefix,
} from '../path';

describe('computePath', () => {
  it('returns /id for root nodes (null parent)', () => {
    expect(computePath(null, 'node-1')).toBe('/node-1');
  });

  it('returns /id for root nodes (undefined parent)', () => {
    expect(computePath(undefined, 'node-1')).toBe('/node-1');
  });

  it('returns /id for root nodes (slash-only parent)', () => {
    expect(computePath('/', 'node-1')).toBe('/node-1');
  });

  it('appends id to parent path', () => {
    expect(computePath('/a', 'b')).toBe('/a/b');
  });

  it('handles deep nesting', () => {
    expect(computePath('/a/b/c', 'd')).toBe('/a/b/c/d');
  });
});

describe('computeDepth', () => {
  it('returns 0 for root nodes', () => {
    expect(computeDepth('/node-1')).toBe(0);
  });

  it('returns 1 for first-level children', () => {
    expect(computeDepth('/a/b')).toBe(1);
  });

  it('returns correct depth for deep nesting', () => {
    expect(computeDepth('/a/b/c/d')).toBe(3);
  });
});

describe('extractAncestorIds', () => {
  it('returns empty array for root nodes', () => {
    expect(extractAncestorIds('/node-1')).toEqual([]);
  });

  it('returns parent id for first-level children', () => {
    expect(extractAncestorIds('/a/b')).toEqual(['a']);
  });

  it('returns all ancestor ids in order', () => {
    expect(extractAncestorIds('/a/b/c/d')).toEqual(['a', 'b', 'c']);
  });
});

describe('extractNodeId', () => {
  it('extracts id from root path', () => {
    expect(extractNodeId('/node-1')).toBe('node-1');
  });

  it('extracts id from nested path', () => {
    expect(extractNodeId('/a/b/c')).toBe('c');
  });
});

describe('rebasePath', () => {
  it('rebases from one parent to another', () => {
    expect(rebasePath('/a/b/c', '/a/b', '/x/y')).toBe('/x/y/c');
  });

  it('rebases to root when new parent is null', () => {
    expect(rebasePath('/a/b/c', '/a/b', null)).toBe('/c');
  });

  it('rebases deep subtrees', () => {
    expect(rebasePath('/a/b/c/d', '/a/b', '/x')).toBe('/x/c/d');
  });
});

describe('isDescendantOf', () => {
  it('returns true for direct child', () => {
    expect(isDescendantOf('/a/b', '/a')).toBe(true);
  });

  it('returns true for deep descendant', () => {
    expect(isDescendantOf('/a/b/c/d', '/a')).toBe(true);
  });

  it('returns false for sibling', () => {
    expect(isDescendantOf('/a/x', '/a/b')).toBe(false);
  });

  it('returns false for self', () => {
    expect(isDescendantOf('/a/b', '/a/b')).toBe(false);
  });

  it('returns false for partial prefix match', () => {
    // "/a-long" should not be a descendant of "/a"
    expect(isDescendantOf('/a-long/b', '/a')).toBe(false);
  });
});

describe('descendantPrefix', () => {
  it('appends /%', () => {
    expect(descendantPrefix('/a/b')).toBe('/a/b/%');
  });
});