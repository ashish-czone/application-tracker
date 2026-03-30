import { describe, it, expect } from 'vitest';
import { splitPayload } from '../split-payload';
import type { FieldDefinition } from '../../types';

/** Helper to build a minimal field definition for tests */
function field(overrides: Partial<FieldDefinition> & { fieldKey: string }): FieldDefinition {
  return {
    id: 'test-id',
    entityType: 'test',
    label: overrides.fieldKey,
    fieldType: 'text',
    uiType: null,
    isRequired: false,
    isSystem: false,
    isCustom: false,
    isUnique: false,
    isQuickCreate: false,
    isReadonly: false,
    maxLength: null,
    defaultValue: null,
    columnName: null,
    lookupEntity: null,
    lookupLabelField: null,
    lookupSearchFields: null,
    tagGroupSlug: null,
    categoryGroupSlug: null,
    fileAccept: null,
    fileMaxSize: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('splitPayload', () => {
  const definitions = [
    field({ fieldKey: 'firstName', columnName: 'first_name' }),
    field({ fieldKey: 'lastName', columnName: 'last_name' }),
    field({ fieldKey: 'email', columnName: 'email' }),
    field({ fieldKey: 'shoe_size', columnName: null, isCustom: true }),
    field({ fieldKey: 'favorite_color', columnName: null, isCustom: true }),
  ];

  it('should split standard and custom fields', () => {
    const payload = {
      firstName: 'Alice',
      lastName: 'Smith',
      shoe_size: 42,
    };

    const result = splitPayload(definitions, payload);

    expect(result.standardFields).toEqual({ firstName: 'Alice', lastName: 'Smith' });
    expect(result.customFields).toEqual({ shoe_size: 42 });
  });

  it('should handle payload with only standard fields', () => {
    const result = splitPayload(definitions, { firstName: 'Alice', email: 'alice@test.com' });

    expect(result.standardFields).toEqual({ firstName: 'Alice', email: 'alice@test.com' });
    expect(result.customFields).toEqual({});
  });

  it('should handle payload with only custom fields', () => {
    const result = splitPayload(definitions, { shoe_size: 42, favorite_color: 'blue' });

    expect(result.standardFields).toEqual({});
    expect(result.customFields).toEqual({ shoe_size: 42, favorite_color: 'blue' });
  });

  it('should ignore unknown keys not in definitions', () => {
    const result = splitPayload(definitions, { firstName: 'Alice', unknownField: 'value' });

    expect(result.standardFields).toEqual({ firstName: 'Alice' });
    expect(result.customFields).toEqual({});
    expect(result.standardFields).not.toHaveProperty('unknownField');
    expect(result.customFields).not.toHaveProperty('unknownField');
  });

  it('should handle empty payload', () => {
    const result = splitPayload(definitions, {});

    expect(result.standardFields).toEqual({});
    expect(result.customFields).toEqual({});
  });

  it('should handle null values', () => {
    const result = splitPayload(definitions, { firstName: null, shoe_size: null });

    expect(result.standardFields).toEqual({ firstName: null });
    expect(result.customFields).toEqual({ shoe_size: null });
  });

  it('should preserve fieldKey as the key (camelCase for standard)', () => {
    const result = splitPayload(definitions, { firstName: 'Alice' });

    // The key in standardFields is 'firstName' (camelCase), not 'first_name' (snake_case)
    expect(Object.keys(result.standardFields)).toEqual(['firstName']);
  });
});
