import { describe, it, expect } from 'vitest';
import { addressColumns, addressColumnNames, ADDRESS_BASE_COLUMNS } from '../schema/columns';

describe('addressColumns', () => {
  it('base column list is stable', () => {
    expect(ADDRESS_BASE_COLUMNS).toEqual([
      'address_line1',
      'address_line2',
      'city',
      'state',
      'postal_code',
      'country_id',
    ]);
  });

  describe('column name generation', () => {
    it('without prefix returns base names unchanged', () => {
      expect(addressColumnNames()).toEqual([
        'address_line1',
        'address_line2',
        'city',
        'state',
        'postal_code',
        'country_id',
      ]);
    });

    it('empty prefix behaves the same as no prefix', () => {
      expect(addressColumnNames({ prefix: '' })).toEqual(addressColumnNames());
    });

    it('with prefix prepends {prefix}_ to every base name', () => {
      expect(addressColumnNames({ prefix: 'billing' })).toEqual([
        'billing_address_line1',
        'billing_address_line2',
        'billing_city',
        'billing_state',
        'billing_postal_code',
        'billing_country_id',
      ]);
    });

    it('supports multiple simultaneous prefixes without collision', () => {
      const billing = addressColumnNames({ prefix: 'billing' });
      const shipping = addressColumnNames({ prefix: 'shipping' });
      const overlap = billing.filter((name) => shipping.includes(name));
      expect(overlap).toEqual([]);
    });
  });

  describe('drizzle column map', () => {
    it('returns a camelCase-keyed object with one drizzle column per base field', () => {
      const cols = addressColumns();
      expect(Object.keys(cols).sort()).toEqual([
        'addressLine1',
        'addressLine2',
        'city',
        'countryId',
        'postalCode',
        'state',
      ]);
    });

    it('maps prefixed snake_case columns back to prefixed camelCase keys', () => {
      const cols = addressColumns({ prefix: 'billing' });
      expect(Object.keys(cols).sort()).toEqual([
        'billingAddressLine1',
        'billingAddressLine2',
        'billingCity',
        'billingCountryId',
        'billingPostalCode',
        'billingState',
      ]);
    });
  });
});
