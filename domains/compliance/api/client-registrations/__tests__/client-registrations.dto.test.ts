import { describe, expect, it } from 'vitest';
import { RegistrationsListQuerySchema } from '../client-registrations.dto';

describe('RegistrationsListQuerySchema', () => {
  it('leaves page/limit undefined when missing (engine supplies defaults)', () => {
    const out = RegistrationsListQuerySchema.parse({});
    expect(out.page).toBeUndefined();
    expect(out.limit).toBeUndefined();
    expect(out.includeDeleted).toBe(false);
  });

  it('coerces page and limit string values to numbers', () => {
    const out = RegistrationsListQuerySchema.parse({ page: '2', limit: '50' });
    expect(out.page).toBe(2);
    expect(out.limit).toBe(50);
  });

  it('falls back to undefined for invalid page/limit', () => {
    expect(RegistrationsListQuerySchema.parse({ page: 'NaN' }).page).toBeUndefined();
    expect(RegistrationsListQuerySchema.parse({ page: '0' }).page).toBeUndefined();
    expect(RegistrationsListQuerySchema.parse({ limit: '-5' }).limit).toBeUndefined();
  });

  it('honours includeDeleted only when string "true"', () => {
    expect(RegistrationsListQuerySchema.parse({ includeDeleted: 'true' }).includeDeleted).toBe(true);
    expect(RegistrationsListQuerySchema.parse({ includeDeleted: 'false' }).includeDeleted).toBe(false);
    expect(RegistrationsListQuerySchema.parse({}).includeDeleted).toBe(false);
  });

  it('passes engine-known fields (clientId, lawId, sort, order) through unchanged', () => {
    const out = RegistrationsListQuerySchema.parse({
      clientId: 'c1',
      lawId: 'l1',
      sort: 'registeredAt',
      order: 'desc',
    });
    expect(out.clientId).toBe('c1');
    expect(out.lawId).toBe('l1');
    expect(out.sort).toBe('registeredAt');
    expect(out.order).toBe('desc');
  });

  it('parses the search field as an optional string (empty stripped)', () => {
    expect(RegistrationsListQuerySchema.parse({ search: 'GST-' }).search).toBe('GST-');
    expect(RegistrationsListQuerySchema.parse({ search: '' }).search).toBeUndefined();
    expect(RegistrationsListQuerySchema.parse({}).search).toBeUndefined();
  });

  it('parses sort:dir compound values as a single string field', () => {
    // The service splits on ':'; the DTO just delivers the raw string.
    const out = RegistrationsListQuerySchema.parse({ sort: 'registeredAt:asc' });
    expect(out.sort).toBe('registeredAt:asc');
  });
});
