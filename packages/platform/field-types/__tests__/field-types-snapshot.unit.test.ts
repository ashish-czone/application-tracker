import { describe, it, expect, beforeAll } from 'vitest';
import { FieldTypeRegistry } from '../registry';
import { coreFieldTypesPlugin } from '@packages/entity-engine/field-types';
import { eavFieldTypesPlugin } from '@packages/eav-attributes/field-types';
import { taxonomyFieldTypesPlugin } from '@packages/taxonomy/field-types';
import { workflowFieldTypesPlugin } from '@packages/workflows/field-types';

/** Expected maps from the existing codebase (eav-attributes/types.ts and query-builder/types.ts) */
const EXPECTED_VALUE_COLUMN_MAP: Record<string, string> = {
  text: 'valueText',
  email: 'valueText',
  phone: 'valueText',
  url: 'valueText',
  textarea: 'valueText',
  rich_text: 'valueText',
  picklist: 'valueText',
  multi_select: 'valueText',
  lookup: 'valueText',
  user: 'valueText',
  auto_number: 'valueText',
  file: 'valueText',
  workflow: 'valueText',
  category: 'valueText',
  number: 'valueNumber',
  currency: 'valueNumber',
  decimal: 'valueNumber',
  date: 'valueDate',
  datetime: 'valueDatetime',
  boolean: 'valueBoolean',
};

const EXPECTED_RELATIONAL_TYPES = new Set(['tags', 'multi_user', 'multi_lookup']);

const EXPECTED_OPERATORS: Record<string, string[]> = {
  text:         ['eq', 'neq', 'like', 'isNull', 'isNotNull'],
  email:        ['eq', 'neq', 'like', 'isNull', 'isNotNull'],
  phone:        ['eq', 'neq', 'like', 'isNull', 'isNotNull'],
  url:          ['eq', 'neq', 'like', 'isNull', 'isNotNull'],
  number:       ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  currency:     ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  decimal:      ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  date:         ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  datetime:     ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  boolean:      ['eq', 'isNull', 'isNotNull'],
  picklist:     ['eq', 'neq', 'in', 'isNull', 'isNotNull'],
  multi_select: ['contains', 'eq', 'isNull', 'isNotNull'],
  lookup:       ['eq', 'neq', 'in', 'isNull', 'isNotNull'],
  user:         ['eq', 'neq', 'in', 'isNull', 'isNotNull'],
  multi_user:   ['contains', 'isNull', 'isNotNull'],
  multi_lookup: ['contains', 'isNull', 'isNotNull'],
  tags:         ['contains', 'isNull', 'isNotNull'],
  category:     ['eq', 'in', 'isNull', 'isNotNull'],
  workflow:     ['eq', 'neq', 'in'],
  auto_number:  ['eq', 'like'],
};

describe('field type plugins produce correct derived maps', () => {
  let registry: FieldTypeRegistry;

  beforeAll(() => {
    registry = new FieldTypeRegistry();
    registry.registerPlugin(coreFieldTypesPlugin);
    registry.registerPlugin(eavFieldTypesPlugin);
    registry.registerPlugin(taxonomyFieldTypesPlugin);
    registry.registerPlugin(workflowFieldTypesPlugin);
    registry.freeze();
  });

  it('registers all 23 field types', () => {
    expect(registry.getAll()).toHaveLength(23);
  });

  it('toValueColumnMap matches FIELD_TYPE_TO_VALUE_COLUMN', () => {
    const map = registry.toValueColumnMap();
    expect(map).toEqual(EXPECTED_VALUE_COLUMN_MAP);
  });

  it('toRelationalSet matches RELATIONAL_FIELD_TYPES', () => {
    const set = registry.toRelationalSet();
    expect(set).toEqual(EXPECTED_RELATIONAL_TYPES);
  });

  it('toOperatorsMap matches OPERATORS_BY_FIELD_TYPE', () => {
    const map = registry.toOperatorsMap();
    // file is not in the expected operators (was never there originally)
    // textarea and rich_text are also not in expected (they're text-like but excluded from lists)
    // Let's check each expected key matches
    for (const [type, ops] of Object.entries(EXPECTED_OPERATORS)) {
      expect(map[type]).toEqual(ops);
    }
  });

  it('user and multi_user have defaultLookupEntity=users', () => {
    expect(registry.getOrThrow('user').defaultLookupEntity).toBe('users');
    expect(registry.getOrThrow('multi_user').defaultLookupEntity).toBe('users');
  });

  it('lookup and multi_lookup have no defaultLookupEntity', () => {
    expect(registry.getOrThrow('lookup').defaultLookupEntity).toBeUndefined();
    expect(registry.getOrThrow('multi_lookup').defaultLookupEntity).toBeUndefined();
  });

  it('all creatable types match FIELD_TYPE_REGISTRY', () => {
    const creatable = registry.getCreatable();
    // auto_number and workflow are not creatable
    expect(creatable.map(t => t.type)).not.toContain('auto_number');
    expect(creatable.map(t => t.type)).not.toContain('workflow');
    // All others are creatable
    expect(creatable).toHaveLength(21);
  });
});
