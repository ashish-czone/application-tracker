import { describe, it, expect } from 'vitest';
import { addressZodSchema } from '../field-type/zod';

const UUID = '11111111-2222-3333-4444-555555555555';

describe('addressZodSchema', () => {
  const schema = addressZodSchema();

  it('accepts an entirely empty address', () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts an address with only null values', () => {
    const result = schema.safeParse({
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      country_id: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a fully populated address', () => {
    const result = schema.safeParse({
      address_line1: '42 Main St',
      address_line2: 'Apt 3B',
      city: 'Mumbai',
      state: 'MH',
      postal_code: '400001',
      country_id: UUID,
    });
    expect(result.success).toBe(true);
  });

  it('rejects when any field is set but city and country are missing', () => {
    const result = schema.safeParse({ address_line1: '42 Main St' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('city');
    expect(paths).toContain('country_id');
  });

  it('rejects when city is set but country is missing', () => {
    const result = schema.safeParse({ city: 'Mumbai' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('country_id');
    expect(paths).not.toContain('city');
  });

  it('rejects when country is set but city is missing', () => {
    const result = schema.safeParse({ country_id: UUID });
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('city');
  });

  it('rejects when country_id is not a valid uuid', () => {
    const result = schema.safeParse({ city: 'Mumbai', country_id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('treats empty strings as unset when deciding whether the address is touched', () => {
    const result = schema.safeParse({
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country_id: '',
    });
    // empty strings pass uuid check for country_id since it's optional+empty
    // but the important behavior: should NOT require city/country when all blank
    expect(result.success).toBe(true);
  });
});
