import { describe, expect, it } from 'vitest';
import { translateClientsQuery, __test__ } from '../clients-query';

describe('translateClientsQuery', () => {
  it('defaults page to 1 and limit to default when missing', () => {
    const out = translateClientsQuery({});
    expect(out.page).toBe(1);
    expect(out.limit).toBe(__test__.CLIENTS_LIST_DEFAULT_LIMIT);
  });

  it('caps limit at MAX (data-fetching rule)', () => {
    const out = translateClientsQuery({ limit: '5000' });
    expect(out.limit).toBe(__test__.CLIENTS_LIST_MAX_LIMIT);
  });

  it('clamps page to 1 when below', () => {
    expect(translateClientsQuery({ page: '0' }).page).toBe(1);
    expect(translateClientsQuery({ page: '-3' }).page).toBe(1);
  });

  it('parses sort=field:dir into { sort, order }', () => {
    expect(translateClientsQuery({ sort: 'name:desc' })).toMatchObject({ sort: 'name', order: 'desc' });
    expect(translateClientsQuery({ sort: 'overdueFilings:asc' })).toMatchObject({
      sort: 'overdueFilings',
      order: 'asc',
    });
  });

  it('accepts only valid status values', () => {
    expect(translateClientsQuery({ status: 'active' }).status).toBe('active');
    expect(translateClientsQuery({ status: 'bogus' }).status).toBeUndefined();
  });

  it('parses comma-separated risk and drops invalid entries', () => {
    expect(translateClientsQuery({ risk: 'critical' }).risks).toEqual(['critical']);
    expect(translateClientsQuery({ risk: 'critical,at-risk' }).risks).toEqual(['critical', 'at-risk']);
    expect(translateClientsQuery({ risk: 'critical,bogus' }).risks).toEqual(['critical']);
    expect(translateClientsQuery({ risk: 'bogus' }).risks).toBeUndefined();
  });

  it('parses comma-separated handlerId list', () => {
    const out = translateClientsQuery({ handlerId: 'u-1,u-2,u-3' });
    expect(out.handlerIds).toEqual(['u-1', 'u-2', 'u-3']);
  });

  it('passes q through as string', () => {
    expect(translateClientsQuery({ q: 'acme' }).q).toBe('acme');
  });

  it('drops empty strings', () => {
    const out = translateClientsQuery({ handlerId: '', q: '', risk: '' });
    expect(out.handlerIds).toBeUndefined();
    expect(out.q).toBeUndefined();
    expect(out.risks).toBeUndefined();
  });
});
