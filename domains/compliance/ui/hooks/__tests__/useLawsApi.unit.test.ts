import { describe, it, expect } from 'vitest';
import { __test__ } from '../useLawsApi';

const { buildOptionsQuery, normaliseIds } = __test__;

describe('laws/options query builder', () => {
  it('returns an empty string when no params are set', () => {
    expect(buildOptionsQuery({})).toBe('');
  });

  it('forwards search and limit', () => {
    expect(buildOptionsQuery({ search: 'gst', limit: 10 })).toBe('?search=gst&limit=10');
  });

  it('joins ids with commas', () => {
    expect(buildOptionsQuery({ ids: ['l1', 'l2'] })).toBe('?ids=l1%2Cl2');
  });

  it('dedupes and sorts ids so cache keys match across permutations', () => {
    expect(normaliseIds(['l2', 'l1', 'l2'])).toEqual(['l1', 'l2']);
    expect(buildOptionsQuery({ ids: ['l2', 'l1'] })).toBe(
      buildOptionsQuery({ ids: ['l1', 'l2'] }),
    );
  });

  it('treats empty ids array as absent', () => {
    expect(normaliseIds([])).toBeUndefined();
    expect(buildOptionsQuery({ ids: [] })).toBe('');
  });
});
