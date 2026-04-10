import { describe, it, expect } from 'vitest';
import { buildFormSchema } from '../buildFormSchema';
import type { FieldDefinition } from '../../types';

function field(overrides: Partial<FieldDefinition> & { fieldKey: string; fieldType: FieldDefinition['fieldType'] }): FieldDefinition {
  return {
    id: 'test-id',
    entityType: 'test',
    label: overrides.fieldKey,
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
    sortOrder: 0,
    picklistOptions: [],
    ...overrides,
  };
}

describe('buildFormSchema', () => {
  it('should create a schema with text field', () => {
    const schema = buildFormSchema([field({ fieldKey: 'name', fieldType: 'text' })]);
    expect(schema.safeParse({ name: 'Alice' }).success).toBe(true);
  });

  it('should enforce maxLength for text fields', () => {
    const schema = buildFormSchema([field({ fieldKey: 'name', fieldType: 'text', maxLength: 5 })]);
    expect(schema.safeParse({ name: 'ABCDEF' }).success).toBe(false);
    expect(schema.safeParse({ name: 'ABC' }).success).toBe(true);
  });

  it('should validate email format', () => {
    const schema = buildFormSchema([field({ fieldKey: 'email', fieldType: 'email', isRequired: true })]);
    expect(schema.safeParse({ email: 'test@test.com' }).success).toBe(true);
    expect(schema.safeParse({ email: 'not-email' }).success).toBe(false);
  });

  it('should validate url format', () => {
    const schema = buildFormSchema([field({ fieldKey: 'site', fieldType: 'url' })]);
    expect(schema.safeParse({ site: 'https://example.com' }).success).toBe(true);
  });

  it('should coerce number fields', () => {
    const schema = buildFormSchema([field({ fieldKey: 'age', fieldType: 'number', isRequired: true })]);
    expect(schema.safeParse({ age: '30' }).success).toBe(true);
    expect(schema.safeParse({ age: 30 }).success).toBe(true);
  });

  it('should require integer for number/currency fields', () => {
    const schema = buildFormSchema([field({ fieldKey: 'amount', fieldType: 'currency', isRequired: true })]);
    expect(schema.safeParse({ amount: 100 }).success).toBe(true);
    expect(schema.safeParse({ amount: 10.5 }).success).toBe(false);
  });

  it('should allow decimal for decimal fields', () => {
    const schema = buildFormSchema([field({ fieldKey: 'rate', fieldType: 'decimal', isRequired: true })]);
    expect(schema.safeParse({ rate: 15.5 }).success).toBe(true);
  });

  it('should validate date format', () => {
    const schema = buildFormSchema([field({ fieldKey: 'dob', fieldType: 'date', isRequired: true })]);
    expect(schema.safeParse({ dob: '2000-01-15' }).success).toBe(true);
    expect(schema.safeParse({ dob: '15/01/2000' }).success).toBe(false);
  });

  it('should create boolean schema', () => {
    const schema = buildFormSchema([field({ fieldKey: 'active', fieldType: 'boolean', isRequired: true })]);
    expect(schema.safeParse({ active: true }).success).toBe(true);
    expect(schema.safeParse({ active: false }).success).toBe(true);
  });

  it('should make required fields required', () => {
    const schema = buildFormSchema([field({ fieldKey: 'name', fieldType: 'text', isRequired: true })]);
    // Empty object should fail for required field
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should make optional fields optional', () => {
    const schema = buildFormSchema([field({ fieldKey: 'notes', fieldType: 'text' })]);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ notes: '' }).success).toBe(true);
  });

  it('should skip readonly fields', () => {
    const schema = buildFormSchema([field({ fieldKey: 'status', fieldType: 'text', isReadonly: true })]);
    // Schema should not include the readonly field
    expect(Object.keys(schema.shape)).not.toContain('status');
  });

  it('should skip auto_number fields', () => {
    const schema = buildFormSchema([field({ fieldKey: 'ticket', fieldType: 'auto_number' })]);
    expect(Object.keys(schema.shape)).not.toContain('ticket');
  });

  it('should handle picklist fields', () => {
    const schema = buildFormSchema([field({
      fieldKey: 'source',
      fieldType: 'picklist',
      isRequired: true,
    })]);
    expect(schema.safeParse({ source: 'direct' }).success).toBe(true);
  });

  it('should handle multi_select fields', () => {
    const schema = buildFormSchema([field({
      fieldKey: 'tags',
      fieldType: 'multi_select',
      isRequired: true,
    })]);
    expect(schema.safeParse({ tags: ['a', 'b'] }).success).toBe(true);
  });

  it('should handle multiple fields', () => {
    const schema = buildFormSchema([
      field({ fieldKey: 'firstName', fieldType: 'text', isRequired: true }),
      field({ fieldKey: 'email', fieldType: 'email', isRequired: true }),
      field({ fieldKey: 'notes', fieldType: 'textarea' }),
    ]);
    expect(schema.safeParse({ firstName: 'Alice', email: 'a@b.com' }).success).toBe(true);
    expect(schema.safeParse({ firstName: 'Alice' }).success).toBe(false); // missing required email
  });
});
