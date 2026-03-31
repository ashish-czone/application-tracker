import { describe, it, expect, beforeEach } from 'vitest';
import { FieldTypeRegistry } from '../registry';
import { defineFieldType } from '../define';
import * as validators from '../validators';

function makeType(type: string, overrides?: Partial<Parameters<typeof defineFieldType>[0]>) {
  return defineFieldType({
    type,
    label: type,
    family: 'text',
    icon: 'Type',
    color: 'bg-blue-100 text-blue-800',
    sortOrder: 0,
    ...overrides,
  });
}

describe('FieldTypeRegistry', () => {
  let registry: FieldTypeRegistry;

  beforeEach(() => {
    registry = new FieldTypeRegistry();
  });

  it('registers and retrieves a field type', () => {
    const ft = makeType('text');
    registry.register(ft);
    expect(registry.get('text')).toBe(ft);
    expect(registry.has('text')).toBe(true);
  });

  it('throws on duplicate registration', () => {
    registry.register(makeType('text'));
    expect(() => registry.register(makeType('text'))).toThrow("already registered");
  });

  it('throws after freeze', () => {
    registry.freeze();
    expect(() => registry.register(makeType('text'))).toThrow("frozen");
  });

  it('getOrThrow throws for unknown type', () => {
    expect(() => registry.getOrThrow('missing')).toThrow("Unknown field type");
  });

  it('getAll returns all registered types', () => {
    registry.register(makeType('text'));
    registry.register(makeType('email'));
    expect(registry.getAll()).toHaveLength(2);
  });

  it('getCreatable filters non-creatable types and sorts by sortOrder', () => {
    registry.register(makeType('auto', { family: 'special', sortOrder: 2 }));
    registry.register(makeType('text', { sortOrder: 1 }));
    registry.register(makeType('email', { sortOrder: 0 }));
    const creatable = registry.getCreatable();
    expect(creatable).toHaveLength(2); // auto is not creatable (special family default)
    expect(creatable[0].type).toBe('email');
    expect(creatable[1].type).toBe('text');
  });

  it('registerPlugin registers multiple types', () => {
    registry.registerPlugin({
      name: 'test',
      fieldTypes: [makeType('text'), makeType('email')],
    });
    expect(registry.getAll()).toHaveLength(2);
  });

  describe('storage helpers', () => {
    it('getEavColumn returns column for EAV types', () => {
      registry.register(makeType('text'));
      expect(registry.getEavColumn('text')).toBe('valueText');
    });

    it('getEavColumn returns undefined for relational types', () => {
      registry.register(makeType('tags', { family: 'taxonomy' }));
      expect(registry.getEavColumn('tags')).toBeUndefined();
    });

    it('isRelational returns true for junction table types', () => {
      registry.register(makeType('tags', { family: 'taxonomy' }));
      registry.register(makeType('text'));
      expect(registry.isRelational('tags')).toBe(true);
      expect(registry.isRelational('text')).toBe(false);
    });
  });

  describe('derived maps', () => {
    beforeEach(() => {
      registry.register(makeType('text'));
      registry.register(defineFieldType({
        type: 'number', label: 'Number', family: 'numeric',
        icon: 'Hash', color: 'bg-green-100', sortOrder: 1,
      }));
      registry.register(defineFieldType({
        type: 'tags', label: 'Tags', family: 'taxonomy',
        icon: 'Tag', color: 'bg-teal-100', sortOrder: 2,
      }));
    });

    it('toValueColumnMap maps EAV types to columns', () => {
      const map = registry.toValueColumnMap();
      expect(map['text']).toBe('valueText');
      expect(map['number']).toBe('valueNumber');
      expect(map['tags']).toBeUndefined();
    });

    it('toRelationalSet returns relational types', () => {
      const set = registry.toRelationalSet();
      expect(set.has('tags')).toBe(true);
      expect(set.has('text')).toBe(false);
    });

    it('toOperatorsMap returns operators per type', () => {
      const map = registry.toOperatorsMap();
      expect(map['text']).toContain('like');
      expect(map['number']).toContain('between');
      expect(map['tags']).toContain('contains');
    });
  });
});

describe('defineFieldType', () => {
  it('applies text family defaults', () => {
    const ft = defineFieldType({
      type: 'text', label: 'Text', family: 'text',
      icon: 'Type', color: 'bg-blue-100', sortOrder: 0,
    });
    expect(ft.storage).toEqual({ type: 'eav', column: 'valueText' });
    expect(ft.validate).toBe(validators.string);
    expect(ft.filterable).toBe(true);
    expect(ft.sortable).toBe(true);
    expect(ft.isArray).toBe(false);
    expect(ft.isReference).toBe(false);
  });

  it('allows overriding family defaults', () => {
    const ft = defineFieldType({
      type: 'email', label: 'Email', family: 'text',
      icon: 'Mail', color: 'bg-indigo-100', sortOrder: 2,
      validate: validators.email,
    });
    expect(ft.validate).toBe(validators.email);
    expect(ft.storage).toEqual({ type: 'eav', column: 'valueText' }); // still from family
  });

  it('reference family sets isReference=true', () => {
    const ft = defineFieldType({
      type: 'lookup', label: 'Lookup', family: 'reference',
      icon: 'Search', color: 'bg-purple-100', sortOrder: 14,
    });
    expect(ft.isReference).toBe(true);
    expect(ft.validate).toBe(validators.uuid);
  });

  it('taxonomy family sets relational storage', () => {
    const ft = defineFieldType({
      type: 'tags', label: 'Tags', family: 'taxonomy',
      icon: 'Tag', color: 'bg-teal-100', sortOrder: 18,
    });
    expect(ft.storage).toEqual({ type: 'relational', through: 'tags' });
    expect(ft.isArray).toBe(true);
  });

  it('special family sets excludeFromList and non-creatable', () => {
    const ft = defineFieldType({
      type: 'auto_number', label: 'Auto Number', family: 'special',
      icon: 'Hash', color: 'bg-gray-100', sortOrder: 21,
    });
    expect(ft.excludeFromList).toBe(true);
    expect(ft.creatable).toBe(false);
    expect(ft.filterable).toBe(false);
  });
});

describe('validators', () => {
  const ctx = (label = 'Test') => ({ label });

  it('string validates string type', () => {
    expect(validators.string('hello', ctx())).toBeNull();
    expect(validators.string(123, ctx())).toMatchObject({ code: 'type' });
  });

  it('string checks maxLength', () => {
    expect(validators.string('hello', { label: 'Test', maxLength: 3 })).toMatchObject({ code: 'maxLength' });
    expect(validators.string('hi', { label: 'Test', maxLength: 3 })).toBeNull();
  });

  it('email validates format', () => {
    expect(validators.email('a@b.c', ctx())).toBeNull();
    expect(validators.email('bad', ctx())).toMatchObject({ code: 'format' });
  });

  it('url validates http prefix', () => {
    expect(validators.url('https://example.com', ctx())).toBeNull();
    expect(validators.url('ftp://example.com', ctx())).toMatchObject({ code: 'format' });
  });

  it('integer validates integers', () => {
    expect(validators.integer(42, ctx())).toBeNull();
    expect(validators.integer('42', ctx())).toBeNull();
    expect(validators.integer(3.14, ctx())).toMatchObject({ code: 'type' });
    expect(validators.integer('abc', ctx())).toMatchObject({ code: 'type' });
  });

  it('decimal allows floats', () => {
    expect(validators.decimal(3.14, ctx())).toBeNull();
    expect(validators.decimal('3.14', ctx())).toBeNull();
  });

  it('date validates YYYY-MM-DD', () => {
    expect(validators.date('2026-03-31', ctx())).toBeNull();
    expect(validators.date('31/03/2026', ctx())).toMatchObject({ code: 'format' });
  });

  it('datetime validates ISO strings', () => {
    expect(validators.datetime('2026-03-31T10:00:00Z', ctx())).toBeNull();
    expect(validators.datetime('not-a-date', ctx())).toMatchObject({ code: 'format' });
  });

  it('boolean validates booleans', () => {
    expect(validators.boolean(true, ctx())).toBeNull();
    expect(validators.boolean('true', ctx())).toMatchObject({ code: 'type' });
  });

  it('uuid validates UUID format', () => {
    expect(validators.uuid('550e8400-e29b-41d4-a716-446655440000', ctx())).toBeNull();
    expect(validators.uuid('not-a-uuid', ctx())).toMatchObject({ code: 'format' });
  });

  it('uuidArray validates arrays of UUIDs', () => {
    expect(validators.uuidArray(['550e8400-e29b-41d4-a716-446655440000'], ctx())).toBeNull();
    expect(validators.uuidArray('not-array', ctx())).toMatchObject({ code: 'type' });
    expect(validators.uuidArray(['bad'], ctx())).toMatchObject({ code: 'format' });
  });

  it('picklist validates against options', () => {
    const c = { label: 'Status', picklistOptions: [{ value: 'a' }, { value: 'b' }] };
    expect(validators.picklist('a', c)).toBeNull();
    expect(validators.picklist('c', c)).toMatchObject({ code: 'picklist' });
  });

  it('multiSelect validates array against options', () => {
    const c = { label: 'Tags', picklistOptions: [{ value: 'a' }, { value: 'b' }] };
    expect(validators.multiSelect(['a', 'b'], c)).toBeNull();
    expect(validators.multiSelect(['c'], c)).toMatchObject({ code: 'picklist' });
    expect(validators.multiSelect('not-array', c)).toMatchObject({ code: 'type' });
  });

  it('noop always passes', () => {
    expect(validators.noop(undefined, ctx())).toBeNull();
    expect(validators.noop(42, ctx())).toBeNull();
  });
});
