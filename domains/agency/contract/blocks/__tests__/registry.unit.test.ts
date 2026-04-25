import { describe, it, expect, beforeEach } from 'vitest';
import { defineMapper, mapperRegistry } from '../registry';

interface FakeRecord {
  id: string;
  name: string;
}

interface FakeProps extends Record<string, unknown> {
  items: Array<{ id: string; name: string }>;
}

function makeMapper(entity: string, block: string) {
  return defineMapper<FakeRecord, FakeProps>({
    entity,
    block,
    map: (records) => ({ items: records.map((r) => ({ id: r.id, name: r.name })) }),
  });
}

describe('mapperRegistry', () => {
  beforeEach(() => {
    mapperRegistry.clear();
  });

  it('registers and retrieves a mapper by (entity, block)', () => {
    mapperRegistry.register(makeMapper('testimonials', 'testimonials-grid'));
    expect(mapperRegistry.get('testimonials', 'testimonials-grid')?.entity).toBe('testimonials');
    expect(mapperRegistry.has('testimonials', 'testimonials-grid')).toBe(true);
  });

  it('returns undefined for unregistered pairs', () => {
    expect(mapperRegistry.get('testimonials', 'missing')).toBeUndefined();
    expect(mapperRegistry.has('missing', 'missing')).toBe(false);
  });

  it('keys are composed of (entity, block), so the same block with different entities coexist', () => {
    mapperRegistry.register(makeMapper('testimonials', 'card-grid'));
    mapperRegistry.register(makeMapper('team-members', 'card-grid'));
    expect(mapperRegistry.get('testimonials', 'card-grid')?.entity).toBe('testimonials');
    expect(mapperRegistry.get('team-members', 'card-grid')?.entity).toBe('team-members');
    expect(mapperRegistry.list()).toHaveLength(2);
  });

  it('replaces the entry when the same (entity, block) pair is registered twice', () => {
    const first = makeMapper('testimonials', 'testimonials-grid');
    const second = {
      ...makeMapper('testimonials', 'testimonials-grid'),
      map: () => ({ items: [{ id: 'override', name: 'v2' }] }),
    };
    mapperRegistry.register(first);
    mapperRegistry.register(second);
    const mapped = mapperRegistry.get('testimonials', 'testimonials-grid')?.map([]);
    expect(mapped).toEqual({ items: [{ id: 'override', name: 'v2' }] });
  });

  it('registerAll inserts each mapper', () => {
    mapperRegistry.registerAll([
      makeMapper('testimonials', 'a'),
      makeMapper('testimonials', 'b'),
      makeMapper('faq-items', 'c'),
    ]);
    expect(mapperRegistry.list()).toHaveLength(3);
  });

  it('map produces the typed props shape', () => {
    const def = makeMapper('testimonials', 'testimonials-grid');
    const result = def.map([
      { id: '1', name: 'Ada' },
      { id: '2', name: 'Linus' },
    ]);
    expect(result).toEqual({
      items: [
        { id: '1', name: 'Ada' },
        { id: '2', name: 'Linus' },
      ],
    });
  });
});
