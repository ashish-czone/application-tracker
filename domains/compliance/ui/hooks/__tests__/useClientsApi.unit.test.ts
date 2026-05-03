import { describe, it, expect } from 'vitest';
import { __test__ } from '../useClientsApi';

const { buildOptionsQuery, normaliseIds } = __test__;

describe('clients/options query builder', () => {
  it('returns an empty string when no params are set', () => {
    expect(buildOptionsQuery({})).toBe('');
  });

  it('forwards search and limit', () => {
    expect(buildOptionsQuery({ search: 'acme', limit: 10 })).toBe('?search=acme&limit=10');
  });

  it('joins ids with commas', () => {
    expect(buildOptionsQuery({ ids: ['c1', 'c2'] })).toBe('?ids=c1%2Cc2');
  });

  it('dedupes and sorts ids so cache keys match across permutations', () => {
    expect(normaliseIds(['c2', 'c1', 'c2'])).toEqual(['c1', 'c2']);
    expect(buildOptionsQuery({ ids: ['c2', 'c1'] })).toBe(
      buildOptionsQuery({ ids: ['c1', 'c2'] }),
    );
  });

  it('treats empty ids array as absent', () => {
    expect(normaliseIds([])).toBeUndefined();
    expect(buildOptionsQuery({ ids: [] })).toBe('');
  });
});
