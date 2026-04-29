import { describe, it, expect } from 'vitest';
import { splitPayload } from '../split-payload';
import type { FieldDefinition, EntityRelationship } from '../../types';

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

  describe('relationshipInputs bucket', () => {
    const rel = (name: string, type: EntityRelationship['type'] = 'hasOne'): EntityRelationship => ({
      name,
      type,
      targetEntity: `target_${name}`,
      label: name,
    });

    it('defaults relationshipInputs to {} when no relationships are declared', () => {
      const result = splitPayload(definitions, { firstName: 'Alice' });
      expect(result.relationshipInputs).toEqual({});
    });

    it('routes nested hasOne payloads to relationshipInputs', () => {
      const result = splitPayload(
        definitions,
        { firstName: 'Alice', credentials: { password: 's3cret' } },
        [rel('credentials', 'hasOne')],
      );

      expect(result.standardFields).toEqual({ firstName: 'Alice' });
      expect(result.relationshipInputs).toEqual({ credentials: { password: 's3cret' } });
    });

    it('routes hasMany array payloads to relationshipInputs', () => {
      const result = splitPayload(
        definitions,
        { firstName: 'Alice', roles: ['r1', 'r2'] },
        [rel('roles', 'hasMany')],
      );

      expect(result.relationshipInputs).toEqual({ roles: ['r1', 'r2'] });
    });

    it('relationship names win over field names when both match (ambiguity guard)', () => {
      // A declared relationship shadows any field with the same key — the engine
      // would never declare both, but we prefer routing to handlers.
      const defsWithClash = [...definitions, field({ fieldKey: 'roles', columnName: 'roles' })];
      const result = splitPayload(
        defsWithClash,
        { roles: ['r1'] },
        [rel('roles', 'hasMany')],
      );

      expect(result.standardFields).not.toHaveProperty('roles');
      expect(result.relationshipInputs).toEqual({ roles: ['r1'] });
    });

    it('ignores relationship keys not present in the payload', () => {
      const result = splitPayload(
        definitions,
        { firstName: 'Alice' },
        [rel('credentials', 'hasOne'), rel('roles', 'hasMany')],
      );

      expect(result.relationshipInputs).toEqual({});
    });

    it('still drops unknown keys that are neither fields nor relationships', () => {
      const result = splitPayload(
        definitions,
        { firstName: 'Alice', credentials: { password: 'x' }, bogus: 42 },
        [rel('credentials', 'hasOne')],
      );

      expect(result.standardFields).toEqual({ firstName: 'Alice' });
      expect(result.relationshipInputs).toEqual({ credentials: { password: 'x' } });
      expect(result).not.toHaveProperty('bogus');
    });
  });
});
