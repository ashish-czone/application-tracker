import { describe, expect, it } from 'vitest';
import {
  ClientsListQuerySchema,
  CreateClientWithContactsSchema,
  DeactivateRegistrationSchema,
  RegisterLawsSchema,
} from '../clients.dto';

describe('ClientsListQuerySchema', () => {
  it('defaults page=1 and limit=25', () => {
    const out = ClientsListQuerySchema.parse({});
    expect(out.page).toBe(1);
    expect(out.limit).toBe(25);
  });

  it('caps limit at 100 (data-fetching rule)', () => {
    expect(ClientsListQuerySchema.parse({ limit: '5000' }).limit).toBe(100);
  });

  it('falls back to defaults on invalid page/limit', () => {
    expect(ClientsListQuerySchema.parse({ page: '0' }).page).toBe(1);
    expect(ClientsListQuerySchema.parse({ page: '-3' }).page).toBe(1);
    expect(ClientsListQuerySchema.parse({ limit: 'nope' }).limit).toBe(25);
  });

  it('parses sort=field:dir as the combined form', () => {
    expect(ClientsListQuerySchema.parse({ sort: 'name:desc' })).toMatchObject({
      sort: 'name',
      order: 'desc',
    });
    expect(ClientsListQuerySchema.parse({ sort: 'overdueFilings:asc' })).toMatchObject({
      sort: 'overdueFilings',
      order: 'asc',
    });
  });

  it('accepts only valid status values', () => {
    expect(ClientsListQuerySchema.parse({ status: 'active' }).status).toBe('active');
    expect(ClientsListQuerySchema.parse({ status: 'bogus' }).status).toBeUndefined();
  });

  it('parses CSV risk param, dropping invalid silently', () => {
    expect(ClientsListQuerySchema.parse({ risk: 'critical' }).risks).toEqual(['critical']);
    expect(ClientsListQuerySchema.parse({ risk: 'critical,at-risk' }).risks).toEqual([
      'critical',
      'at-risk',
    ]);
    expect(ClientsListQuerySchema.parse({ risk: 'critical,bogus' }).risks).toEqual(['critical']);
    expect(ClientsListQuerySchema.parse({ risk: 'bogus' }).risks).toBeUndefined();
  });

  it('passes handlerId CSV through as a string array', () => {
    expect(ClientsListQuerySchema.parse({ handlerId: 'u-1,u-2,u-3' }).handlerIds).toEqual([
      'u-1',
      'u-2',
      'u-3',
    ]);
  });

  it('coerces empty strings to undefined', () => {
    const out = ClientsListQuerySchema.parse({ q: '', risk: '', handlerId: '' });
    expect(out.q).toBeUndefined();
    expect(out.risks).toBeUndefined();
    expect(out.handlerIds).toBeUndefined();
  });
});

describe('CreateClientWithContactsSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = CreateClientWithContactsSchema.parse({
      client: { name: 'Acme', legalName: 'Acme Pvt Ltd' },
      contacts: [{ fullName: 'Alice' }],
    });
    expect(result.client.name).toBe('Acme');
    expect(result.contacts).toHaveLength(1);
  });

  it('rejects when contacts is empty', () => {
    expect(() =>
      CreateClientWithContactsSchema.parse({
        client: { name: 'Acme', legalName: 'Acme Pvt Ltd' },
        contacts: [],
      }),
    ).toThrow();
  });

  it('rejects when client.name is missing', () => {
    expect(() =>
      CreateClientWithContactsSchema.parse({
        client: { legalName: 'Acme Pvt Ltd' },
        contacts: [{ fullName: 'Alice' }],
      }),
    ).toThrow();
  });
});

describe('RegisterLawsSchema', () => {
  it('accepts a non-empty array of law codes', () => {
    expect(RegisterLawsSchema.parse({ lawCodes: ['GST', 'ITR'] })).toEqual({
      lawCodes: ['GST', 'ITR'],
    });
  });

  it('rejects an empty lawCodes array', () => {
    expect(() => RegisterLawsSchema.parse({ lawCodes: [] })).toThrow();
  });
});

describe('DeactivateRegistrationSchema', () => {
  it('accepts an ISO datetime', () => {
    expect(
      DeactivateRegistrationSchema.parse({ deactivatedAt: '2026-03-01T00:00:00Z' }).deactivatedAt,
    ).toBe('2026-03-01T00:00:00Z');
  });

  it('accepts a date-only string', () => {
    expect(
      DeactivateRegistrationSchema.parse({ deactivatedAt: '2026-03-01' }).deactivatedAt,
    ).toBe('2026-03-01');
  });

  it('rejects an unparseable date', () => {
    expect(() => DeactivateRegistrationSchema.parse({ deactivatedAt: 'not-a-date' })).toThrow();
  });
});
