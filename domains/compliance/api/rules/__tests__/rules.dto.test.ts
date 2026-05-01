import { describe, expect, it } from 'vitest';
import { RulesListQuerySchema } from '../rules.dto';

describe('RulesListQuerySchema', () => {
  it('defaults page=1 and limit=25', () => {
    const out = RulesListQuerySchema.parse({});
    expect(out.page).toBe(1);
    expect(out.limit).toBe(25);
  });

  it('caps limit at 100 (data-fetching rule)', () => {
    expect(RulesListQuerySchema.parse({ limit: '5000' }).limit).toBe(100);
  });

  it('falls back to defaults on invalid page/limit', () => {
    const out = RulesListQuerySchema.parse({ page: 'nope', limit: '-3' });
    expect(out.page).toBe(1);
    expect(out.limit).toBe(25);
  });

  it('parses sort=field:dir as the combined form', () => {
    expect(RulesListQuerySchema.parse({ sort: 'updatedAt:desc' })).toMatchObject({
      sort: 'updatedAt',
      order: 'desc',
    });
  });

  it('accepts split sort + order params', () => {
    const out = RulesListQuerySchema.parse({ sort: 'createdAt', order: 'asc' });
    expect(out.sort).toBe('createdAt');
    expect(out.order).toBe('asc');
  });

  it('accepts only valid status values', () => {
    expect(RulesListQuerySchema.parse({ status: 'active' }).status).toBe('active');
    expect(RulesListQuerySchema.parse({ status: 'bogus' }).status).toBeUndefined();
  });

  it('parses CSV enum params, dropping invalid members silently', () => {
    expect(RulesListQuerySchema.parse({ frequency: 'monthly,quarterly' }).frequencies).toEqual([
      'monthly',
      'quarterly',
    ]);
    expect(RulesListQuerySchema.parse({ frequency: 'monthly,bogus' }).frequencies).toEqual([
      'monthly',
    ]);
    expect(RulesListQuerySchema.parse({ jurisdiction: 'central,state' }).jurisdictions).toEqual([
      'central',
      'state',
    ]);
    expect(RulesListQuerySchema.parse({ lawGroup: 'gst,itr' }).lawGroups).toEqual(['gst', 'itr']);
    expect(RulesListQuerySchema.parse({ lawGroup: 'bogus' }).lawGroups).toBeUndefined();
  });

  it('passes lawId CSV through as a string array', () => {
    expect(RulesListQuerySchema.parse({ lawId: 'l1,l2,l3' }).lawIds).toEqual(['l1', 'l2', 'l3']);
  });

  it('passes q through as string', () => {
    expect(RulesListQuerySchema.parse({ q: 'GST' }).q).toBe('GST');
  });

  it('coerces empty strings to undefined', () => {
    const out = RulesListQuerySchema.parse({ q: '', frequency: '', lawId: '' });
    expect(out.q).toBeUndefined();
    expect(out.frequencies).toBeUndefined();
    expect(out.lawIds).toBeUndefined();
  });
});
