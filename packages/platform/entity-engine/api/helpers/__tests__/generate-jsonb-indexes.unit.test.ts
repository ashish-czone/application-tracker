import { describe, it, expect } from 'vitest';
import { pgTable, uuid, jsonb, text } from 'drizzle-orm/pg-core';
import {
  generateJsonbIndexesForEntity,
  generateJsonbIndexes,
} from '../generate-jsonb-indexes';
import type { EntityConfig } from '../../types';

const testTable = pgTable('widgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  customFields: jsonb('custom_fields').notNull().default({}),
});

function mockConfig(overrides: Partial<EntityConfig> = {}): EntityConfig {
  return {
    entityType: 'widgets',
    singularName: 'Widget',
    pluralName: 'Widgets',
    slug: 'widgets',
    table: testTable as any,
    systemColumns: ['id', 'customFields'],
    searchColumns: [],
    defaultSort: 'createdAt',
    sortableColumns: {},
    fieldMeta: {},
    sections: [],
    ui: { icon: 'box', nameField: 'name' },
    customFields: true,
    ...overrides,
  };
}

describe('generateJsonbIndexesForEntity', () => {
  it('emits nothing when customFields is not the JSONB mode', () => {
    expect(generateJsonbIndexesForEntity(mockConfig({ customFields: false }))).toEqual([]);
    expect(generateJsonbIndexesForEntity(mockConfig({ customFields: 'eav' }))).toEqual([]);
  });

  it('emits nothing when no field is marked indexed', () => {
    const config = mockConfig({
      fieldMeta: {
        color: { label: 'Color', fieldType: 'text' },
      },
    });
    expect(generateJsonbIndexesForEntity(config)).toEqual([]);
  });

  it('emits one statement per indexed field', () => {
    const config = mockConfig({
      fieldMeta: {
        color: { label: 'Color', fieldType: 'text', indexed: true },
        qty: { label: 'Quantity', fieldType: 'number', indexed: true },
        plain: { label: 'Plain', fieldType: 'text' },
      },
    });

    const stmts = generateJsonbIndexesForEntity(config);
    expect(stmts).toHaveLength(2);

    const color = stmts.find((s) => s.fieldKey === 'color')!;
    expect(color.indexName).toBe('idx_widgets_cf_color');
    expect(color.sql).toBe(
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_widgets_cf_color ON widgets ((custom_fields ->> 'color'));",
    );

    const qty = stmts.find((s) => s.fieldKey === 'qty')!;
    expect(qty.sql).toBe(
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_widgets_cf_qty ON widgets ((custom_fields ->> 'qty')::numeric);",
    );
  });

  it('casts date/datetime/boolean appropriately', () => {
    const config = mockConfig({
      fieldMeta: {
        birthday: { label: 'Birthday', fieldType: 'date', indexed: true },
        lastSeen: { label: 'Last Seen', fieldType: 'datetime', indexed: true },
        isActive: { label: 'Active', fieldType: 'boolean', indexed: true },
      },
    });

    const stmts = generateJsonbIndexesForEntity(config);
    expect(stmts.find((s) => s.fieldKey === 'birthday')!.sql).toContain('::date');
    expect(stmts.find((s) => s.fieldKey === 'lastSeen')!.sql).toContain('::timestamptz');
    expect(stmts.find((s) => s.fieldKey === 'isActive')!.sql).toContain('::boolean');
  });

  it('skips system fields even when indexed', () => {
    const config = mockConfig({
      fieldMeta: {
        id: { label: 'Id', fieldType: 'text', indexed: true, isSystem: true },
      },
    });
    expect(generateJsonbIndexesForEntity(config)).toEqual([]);
  });

  it('truncates index names to 63 characters', () => {
    const longKey = 'a'.repeat(100);
    const config = mockConfig({
      fieldMeta: {
        [longKey]: { label: 'Long', fieldType: 'text', indexed: true },
      },
    });
    const [stmt] = generateJsonbIndexesForEntity(config);
    expect(stmt.indexName.length).toBeLessThanOrEqual(63);
  });
});

describe('generateJsonbIndexes', () => {
  it('flattens statements across multiple configs', () => {
    const a = mockConfig({
      entityType: 'a',
      slug: 'a',
      table: pgTable('a_table', {
        id: uuid('id').primaryKey(),
        customFields: jsonb('custom_fields').notNull().default({}),
      }) as any,
      fieldMeta: { one: { label: 'One', fieldType: 'text', indexed: true } },
    });
    const b = mockConfig({
      entityType: 'b',
      slug: 'b',
      table: pgTable('b_table', {
        id: uuid('id').primaryKey(),
        customFields: jsonb('custom_fields').notNull().default({}),
      }) as any,
      fieldMeta: { two: { label: 'Two', fieldType: 'number', indexed: true } },
    });

    const stmts = generateJsonbIndexes([a, b]);
    expect(stmts).toHaveLength(2);
    expect(stmts.map((s) => s.table)).toEqual(['a_table', 'b_table']);
  });
});
