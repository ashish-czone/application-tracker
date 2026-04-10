import { describe, it, expect } from 'vitest';
import { validatePayload, type FieldDefinitionWithOptions } from '../validate-payload';

/** Helper to build a minimal field definition for tests */
function field(overrides: Partial<FieldDefinitionWithOptions> & { fieldKey: string; fieldType: FieldDefinitionWithOptions['fieldType'] }): FieldDefinitionWithOptions {
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
    createdAt: new Date(),
    updatedAt: new Date(),
    picklistOptions: [],
    ...overrides,
  };
}

describe('validatePayload', () => {
  // --- Required fields ---
  describe('required fields', () => {
    const defs = [field({ fieldKey: 'name', fieldType: 'text', isRequired: true, label: 'Name' })];

    it('should fail when required field is missing', () => {
      const result = validatePayload(defs, {});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ field: 'name', code: 'required' });
    });

    it('should fail when required field is null', () => {
      const result = validatePayload(defs, { name: null });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ field: 'name', code: 'required' });
    });

    it('should fail when required field is empty string', () => {
      const result = validatePayload(defs, { name: '' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ field: 'name', code: 'required' });
    });

    it('should pass required check when partial=true and field missing', () => {
      const result = validatePayload(defs, {}, { partial: true });
      expect(result.valid).toBe(true);
    });

    it('should pass when required field is present', () => {
      const result = validatePayload(defs, { name: 'Alice' });
      expect(result.valid).toBe(true);
    });
  });

  // --- Unknown keys ---
  describe('unknown keys', () => {
    const defs = [field({ fieldKey: 'name', fieldType: 'text' })];

    it('should reject unknown keys in payload', () => {
      const result = validatePayload(defs, { name: 'Alice', unknownField: 'value' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(expect.objectContaining({ field: 'unknownField', code: 'unknown' }));
    });
  });

  // --- Text fields ---
  describe('text fields', () => {
    const defs = [field({ fieldKey: 'name', fieldType: 'text', maxLength: 10, label: 'Name' })];

    it('should accept valid string', () => {
      expect(validatePayload(defs, { name: 'Alice' }).valid).toBe(true);
    });

    it('should reject non-string', () => {
      const result = validatePayload(defs, { name: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'type' });
    });

    it('should reject string exceeding maxLength', () => {
      const result = validatePayload(defs, { name: 'A'.repeat(11) });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'maxLength' });
    });

    it('should accept string at maxLength', () => {
      expect(validatePayload(defs, { name: 'A'.repeat(10) }).valid).toBe(true);
    });
  });

  // --- Email fields ---
  describe('email fields', () => {
    const defs = [field({ fieldKey: 'email', fieldType: 'email', label: 'Email' })];

    it('should accept valid email', () => {
      expect(validatePayload(defs, { email: 'alice@test.com' }).valid).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = validatePayload(defs, { email: 'not-an-email' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'format' });
    });

    it('should reject non-string', () => {
      const result = validatePayload(defs, { email: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'type' });
    });
  });

  // --- URL fields ---
  describe('url fields', () => {
    const defs = [field({ fieldKey: 'website', fieldType: 'url', label: 'Website' })];

    it('should accept http URL', () => {
      expect(validatePayload(defs, { website: 'http://example.com' }).valid).toBe(true);
    });

    it('should accept https URL', () => {
      expect(validatePayload(defs, { website: 'https://example.com' }).valid).toBe(true);
    });

    it('should reject URL without protocol', () => {
      const result = validatePayload(defs, { website: 'example.com' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'format' });
    });
  });

  // --- Number fields ---
  describe('number fields', () => {
    const defs = [field({ fieldKey: 'age', fieldType: 'number', label: 'Age' })];

    it('should accept integer number', () => {
      expect(validatePayload(defs, { age: 30 }).valid).toBe(true);
    });

    it('should accept numeric string', () => {
      expect(validatePayload(defs, { age: '30' }).valid).toBe(true);
    });

    it('should reject non-integer number', () => {
      const result = validatePayload(defs, { age: 30.5 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'type' });
    });

    it('should reject non-numeric string', () => {
      const result = validatePayload(defs, { age: 'abc' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'type' });
    });
  });

  // --- Currency fields ---
  describe('currency fields', () => {
    const defs = [field({ fieldKey: 'salary', fieldType: 'currency', label: 'Salary' })];

    it('should accept integer (cents)', () => {
      expect(validatePayload(defs, { salary: 180000 }).valid).toBe(true);
    });

    it('should reject decimal', () => {
      const result = validatePayload(defs, { salary: 1800.50 });
      expect(result.valid).toBe(false);
    });
  });

  // --- Decimal fields ---
  describe('decimal fields', () => {
    const defs = [field({ fieldKey: 'rate', fieldType: 'decimal', label: 'Rate' })];

    it('should accept decimal number', () => {
      expect(validatePayload(defs, { rate: 15.5 }).valid).toBe(true);
    });

    it('should accept integer', () => {
      expect(validatePayload(defs, { rate: 15 }).valid).toBe(true);
    });
  });

  // --- Date fields ---
  describe('date fields', () => {
    const defs = [field({ fieldKey: 'dob', fieldType: 'date', label: 'DOB' })];

    it('should accept YYYY-MM-DD format', () => {
      expect(validatePayload(defs, { dob: '2000-01-15' }).valid).toBe(true);
    });

    it('should reject invalid format', () => {
      const result = validatePayload(defs, { dob: '15/01/2000' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'format' });
    });

    it('should reject non-string', () => {
      const result = validatePayload(defs, { dob: 20000115 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'type' });
    });
  });

  // --- Datetime fields ---
  describe('datetime fields', () => {
    const defs = [field({ fieldKey: 'loginAt', fieldType: 'datetime', label: 'Login At' })];

    it('should accept ISO datetime string', () => {
      expect(validatePayload(defs, { loginAt: '2024-01-15T10:30:00.000Z' }).valid).toBe(true);
    });

    it('should reject unparseable datetime', () => {
      const result = validatePayload(defs, { loginAt: 'not-a-date' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'format' });
    });
  });

  // --- Boolean fields ---
  describe('boolean fields', () => {
    const defs = [field({ fieldKey: 'active', fieldType: 'boolean', label: 'Active' })];

    it('should accept true', () => {
      expect(validatePayload(defs, { active: true }).valid).toBe(true);
    });

    it('should accept false', () => {
      expect(validatePayload(defs, { active: false }).valid).toBe(true);
    });

    it('should reject string "true"', () => {
      const result = validatePayload(defs, { active: 'true' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'type' });
    });
  });

  // --- Picklist fields ---
  describe('picklist fields', () => {
    const defs = [field({
      fieldKey: 'source',
      fieldType: 'picklist',
      label: 'Source',
      picklistOptions: [
        { id: '1', fieldId: 'f1', label: 'Direct', value: 'direct', isDefault: false, sortOrder: 0 },
        { id: '2', fieldId: 'f1', label: 'Referral', value: 'referral', isDefault: false, sortOrder: 1 },
      ],
    })];

    it('should accept valid option', () => {
      expect(validatePayload(defs, { source: 'direct' }).valid).toBe(true);
    });

    it('should reject invalid option', () => {
      const result = validatePayload(defs, { source: 'invalid' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'picklist' });
    });

    it('should reject non-string', () => {
      const result = validatePayload(defs, { source: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'type' });
    });
  });

  // --- Multi-select fields ---
  describe('multi_select fields', () => {
    const defs = [field({
      fieldKey: 'tags',
      fieldType: 'multi_select',
      label: 'Tags',
      picklistOptions: [
        { id: '1', fieldId: 'f1', label: 'A', value: 'a', isDefault: false, sortOrder: 0 },
        { id: '2', fieldId: 'f1', label: 'B', value: 'b', isDefault: false, sortOrder: 1 },
      ],
    })];

    it('should accept valid array', () => {
      expect(validatePayload(defs, { tags: ['a', 'b'] }).valid).toBe(true);
    });

    it('should reject non-array', () => {
      const result = validatePayload(defs, { tags: 'a' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'type' });
    });

    it('should reject invalid option in array', () => {
      const result = validatePayload(defs, { tags: ['a', 'invalid'] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'picklist' });
    });
  });

  // --- Lookup / User fields ---
  describe('lookup and user fields', () => {
    const defs = [field({ fieldKey: 'manager', fieldType: 'user', label: 'Manager' })];

    it('should accept valid UUID', () => {
      expect(validatePayload(defs, { manager: '550e8400-e29b-41d4-a716-446655440000' }).valid).toBe(true);
    });

    it('should reject non-UUID string', () => {
      const result = validatePayload(defs, { manager: 'not-a-uuid' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'format' });
    });
  });

  // --- Auto-number fields ---
  describe('auto_number fields', () => {
    const defs = [field({ fieldKey: 'ticketNumber', fieldType: 'auto_number', label: 'Ticket #' })];

    it('should reject when user tries to set value', () => {
      const result = validatePayload(defs, { ticketNumber: 'TK-001' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'auto_number' });
    });

    it('should pass when auto_number not in payload', () => {
      expect(validatePayload(defs, {}).valid).toBe(true);
    });
  });

  // --- Readonly fields ---
  describe('readonly fields', () => {
    const defs = [field({ fieldKey: 'status', fieldType: 'text', isReadonly: true, label: 'Status' })];

    it('should reject readonly fields on partial update', () => {
      const result = validatePayload(defs, { status: 'active' }, { partial: true });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'readonly' });
    });

    it('should allow readonly fields on create (not partial)', () => {
      // Readonly fields can be set initially on create
      const result = validatePayload(defs, { status: 'active' });
      expect(result.valid).toBe(true);
    });
  });

  // --- Optional fields with null/undefined ---
  describe('optional fields', () => {
    const defs = [field({ fieldKey: 'notes', fieldType: 'textarea', label: 'Notes' })];

    it('should skip validation for null value', () => {
      expect(validatePayload(defs, { notes: null }).valid).toBe(true);
    });

    it('should skip validation for undefined value', () => {
      expect(validatePayload(defs, { notes: undefined }).valid).toBe(true);
    });

    it('should skip validation for empty string on optional field', () => {
      expect(validatePayload(defs, { notes: '' }).valid).toBe(true);
    });
  });

  // --- Phone fields ---
  describe('phone fields', () => {
    const defs = [field({ fieldKey: 'phone', fieldType: 'phone', maxLength: 20, label: 'Phone' })];

    it('should accept valid phone string', () => {
      expect(validatePayload(defs, { phone: '+15551234567' }).valid).toBe(true);
    });

    it('should reject non-string', () => {
      const result = validatePayload(defs, { phone: 5551234567 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ code: 'type' });
    });
  });

  // --- Multiple errors ---
  describe('multiple errors', () => {
    const defs = [
      field({ fieldKey: 'name', fieldType: 'text', isRequired: true, label: 'Name' }),
      field({ fieldKey: 'email', fieldType: 'email', isRequired: true, label: 'Email' }),
    ];

    it('should collect all errors', () => {
      const result = validatePayload(defs, {});
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  // --- Empty payload with no required fields ---
  describe('empty payload', () => {
    const defs = [field({ fieldKey: 'notes', fieldType: 'text', label: 'Notes' })];

    it('should be valid when no required fields', () => {
      expect(validatePayload(defs, {}).valid).toBe(true);
    });
  });
});
