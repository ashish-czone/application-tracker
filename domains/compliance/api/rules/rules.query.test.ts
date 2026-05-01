import { describe, expect, it } from 'vitest';
import { translateRulesQuery, __test__ } from './rules.query';

describe('translateRulesQuery', () => {
  it('defaults page=1 and limit=DEFAULT', () => {
    const out = translateRulesQuery({});
    expect(out.page).toBe(1);
    expect(out.limit).toBe(__test__.RULES_LIST_DEFAULT_LIMIT);
  });

  it('caps limit at MAX (data-fetching rule)', () => {
    expect(translateRulesQuery({ limit: '5000' }).limit).toBe(__test__.RULES_LIST_MAX_LIMIT);
  });

  it('parses sort=field:dir', () => {
    expect(translateRulesQuery({ sort: 'updatedAt:desc' })).toMatchObject({
      sort: 'updatedAt',
      order: 'desc',
    });
  });

  it('accepts only valid status', () => {
    expect(translateRulesQuery({ status: 'active' }).status).toBe('active');
    expect(translateRulesQuery({ status: 'bogus' }).status).toBeUndefined();
  });

  it('parses comma-separated frequencies / jurisdictions / lawGroups, dropping invalid', () => {
    expect(translateRulesQuery({ frequency: 'monthly,quarterly' }).frequencies).toEqual([
      'monthly',
      'quarterly',
    ]);
    expect(translateRulesQuery({ frequency: 'monthly,bogus' }).frequencies).toEqual(['monthly']);
    expect(translateRulesQuery({ jurisdiction: 'central,state' }).jurisdictions).toEqual([
      'central',
      'state',
    ]);
    expect(translateRulesQuery({ lawGroup: 'gst,itr' }).lawGroups).toEqual(['gst', 'itr']);
    expect(translateRulesQuery({ lawGroup: 'bogus' }).lawGroups).toBeUndefined();
  });

  it('passes lawId CSV through as a string array', () => {
    expect(translateRulesQuery({ lawId: 'l1,l2,l3' }).lawIds).toEqual(['l1', 'l2', 'l3']);
  });

  it('passes q through as string', () => {
    expect(translateRulesQuery({ q: 'GST' }).q).toBe('GST');
  });

  it('drops empty strings', () => {
    const out = translateRulesQuery({ q: '', frequency: '', lawId: '' });
    expect(out.q).toBeUndefined();
    expect(out.frequencies).toBeUndefined();
    expect(out.lawIds).toBeUndefined();
  });
});
