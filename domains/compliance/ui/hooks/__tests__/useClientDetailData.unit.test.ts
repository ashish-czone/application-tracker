import { describe, expect, it } from 'vitest';
import { __test__ } from '../useClientDetailData';

const { buildRegistrationsListQueryString } = __test__;

/**
 * The Registrations tab on the client detail page round-trips
 * pagination, sort, and search to the server. Assert the query-string
 * shape so refactors of the hook don't silently drop a param the server
 * relies on (`clientId`, `sort`, etc.).
 */
describe('buildRegistrationsListQueryString', () => {
  it('emits sane defaults when only clientId is provided', () => {
    const qs = buildRegistrationsListQueryString('c1', {});
    const params = new URLSearchParams(qs);
    expect(params.get('page')).toBe('1');
    expect(params.get('limit')).toBe('25');
    expect(params.get('sort')).toBe('registeredAt:desc');
    expect(params.get('clientId')).toBe('c1');
    expect(params.get('search')).toBeNull();
  });

  it('forwards page, limit, sort, and search verbatim', () => {
    const qs = buildRegistrationsListQueryString('c1', {
      page: 3,
      limit: 50,
      sort: 'effectiveFrom:asc',
      search: 'GST-2024',
    });
    const params = new URLSearchParams(qs);
    expect(params.get('page')).toBe('3');
    expect(params.get('limit')).toBe('50');
    expect(params.get('sort')).toBe('effectiveFrom:asc');
    expect(params.get('search')).toBe('GST-2024');
    expect(params.get('clientId')).toBe('c1');
  });

  it('omits empty/missing search', () => {
    const qs = buildRegistrationsListQueryString('c1', { search: '' });
    expect(new URLSearchParams(qs).get('search')).toBeNull();
  });

  it('omits clientId when nullish (hook will gate via `enabled`)', () => {
    const qs = buildRegistrationsListQueryString(null, {});
    expect(new URLSearchParams(qs).get('clientId')).toBeNull();
    expect(new URLSearchParams(qs).get('page')).toBe('1');
  });

  it('URL-encodes clientId and search values safely', () => {
    const qs = buildRegistrationsListQueryString('c with spaces', { search: 'a&b' });
    expect(qs).toContain('clientId=c+with+spaces');
    expect(qs).toContain('search=a%26b');
  });
});
