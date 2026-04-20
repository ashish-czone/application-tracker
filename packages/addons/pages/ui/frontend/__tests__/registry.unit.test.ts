import { describe, it, expect, beforeEach } from 'vitest';
import { createElement } from 'react';
import { defineBlock, blockRegistry } from '../registry';

function makeBlock(kind: string, category?: string) {
  return defineBlock({
    kind,
    name: kind,
    category,
    fields: {},
    component: () => createElement('div', null, kind),
  });
}

describe('blockRegistry', () => {
  beforeEach(() => {
    blockRegistry.clear();
  });

  it('registers and retrieves a block by kind', () => {
    blockRegistry.register(makeBlock('hero-split'));
    expect(blockRegistry.get('hero-split')?.kind).toBe('hero-split');
    expect(blockRegistry.has('hero-split')).toBe(true);
  });

  it('returns undefined for unregistered kinds', () => {
    expect(blockRegistry.get('missing')).toBeUndefined();
    expect(blockRegistry.has('missing')).toBe(false);
  });

  it('replaces the entry when the same kind is registered twice', () => {
    const first = makeBlock('hero-split');
    const second = { ...makeBlock('hero-split'), name: 'Hero Split v2' };
    blockRegistry.register(first);
    blockRegistry.register(second);
    expect(blockRegistry.get('hero-split')?.name).toBe('Hero Split v2');
  });

  it('registerAll inserts each block', () => {
    blockRegistry.registerAll([makeBlock('a'), makeBlock('b'), makeBlock('c')]);
    expect(blockRegistry.list().map((b) => b.kind).sort()).toEqual(['a', 'b', 'c']);
  });

  it('groups by category, defaulting to "Other"', () => {
    blockRegistry.registerAll([
      makeBlock('hero-split', 'Hero'),
      makeBlock('hero-centered', 'Hero'),
      makeBlock('text', 'Content'),
      makeBlock('uncategorised'),
    ]);
    const grouped = blockRegistry.listByCategory();
    expect(Object.keys(grouped).sort()).toEqual(['Content', 'Hero', 'Other']);
    expect(grouped.Hero.map((b) => b.kind).sort()).toEqual(['hero-centered', 'hero-split']);
    expect(grouped.Other.map((b) => b.kind)).toEqual(['uncategorised']);
  });
});
