import { describe, it, expect } from 'vitest';
import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { defineEntity } from '../../define-entity';
import { buildInMemoryFields, buildInMemoryLayout } from '../build-in-memory-definitions';

const testTable = pgTable('widgets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  priority: integer('priority'),
  isActive: boolean('is_active').notNull().default(true),
  assigneeId: text('assignee_id'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
});

function makeConfig() {
  return defineEntity({
    table: testTable,
    slug: 'widgets',
    fields: {
      name: { type: 'text', label: 'Name', required: true, isLabel: true, quickCreate: true },
      status: {
        type: 'picklist',
        label: 'Status',
        options: [
          { label: 'Draft', value: 'draft', isDefault: true },
          { label: 'Published', value: 'published' },
        ],
      },
      priority: { type: 'number', label: 'Priority' },
      assigneeId: { type: 'belongsTo', label: 'Assignee', entity: 'users' },
    },
    sections: [
      { name: 'Basics', columns: 2, fields: ['name', 'status'] },
    ],
    ui: { icon: 'Box' },
  });
}

describe('buildInMemoryFields', () => {
  it('produces one field per fieldMeta entry plus the implicit system fields', () => {
    const fields = buildInMemoryFields(makeConfig());
    const keys = fields.map((f) => f.fieldKey);

    expect(keys).toContain('name');
    expect(keys).toContain('status');
    expect(keys).toContain('priority');
    expect(keys).toContain('assigneeId');
    // Implicit system fields appended when the columns exist on the table
    expect(keys).toContain('createdBy');
    expect(keys).toContain('createdAt');
    expect(keys).toContain('updatedAt');
  });

  it('skips infrastructure columns', () => {
    const keys = buildInMemoryFields(makeConfig()).map((f) => f.fieldKey);
    expect(keys).not.toContain('id');
    expect(keys).not.toContain('deletedAt');
    expect(keys).not.toContain('deletedBy');
  });

  it('uses deterministic in-memory ids with the in-memory: prefix', () => {
    const fields = buildInMemoryFields(makeConfig());
    const nameField = fields.find((f) => f.fieldKey === 'name')!;
    expect(nameField.id).toBe('in-memory:widgets:name');
  });

  it('attaches picklist options inline and synthesizes stable option ids', () => {
    const fields = buildInMemoryFields(makeConfig());
    const statusField = fields.find((f) => f.fieldKey === 'status')!;
    expect(statusField.picklistOptions).toHaveLength(2);
    expect(statusField.picklistOptions[0]).toMatchObject({
      id: 'in-memory:widgets:status:option:draft',
      fieldId: 'in-memory:widgets:status',
      value: 'draft',
      isDefault: true,
      sortOrder: 0,
    });
    expect(statusField.picklistOptions[1].value).toBe('published');
  });

  it('flags implicit system fields with isSystem and isReadonly', () => {
    const fields = buildInMemoryFields(makeConfig());
    const createdAt = fields.find((f) => f.fieldKey === 'createdAt')!;
    expect(createdAt.isSystem).toBe(true);
    expect(createdAt.isReadonly).toBe(true);
    expect(createdAt.fieldType).toBe('datetime');
  });

  it('returns an empty list when the config has no fieldMeta entries', () => {
    const emptyConfig = defineEntity({
      table: pgTable('empty', { id: text('id').primaryKey() }),
      slug: 'empty',
      fields: {},
      ui: { icon: 'Box' },
    });
    expect(buildInMemoryFields(emptyConfig)).toEqual([]);
  });

  it('honours computedColumns as additional skip entries', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'widgets',
      fields: {
        name: { type: 'text', label: 'Name' },
      },
      computedColumns: [{ name: 'status', expression: {} as never }],
      ui: { icon: 'Box' },
    });
    const keys = buildInMemoryFields(config).map((f) => f.fieldKey);
    expect(keys).not.toContain('status');
  });
});

describe('buildInMemoryLayout', () => {
  it('produces a FullLayout with code-defined sections and placed fields', () => {
    const layout = buildInMemoryLayout(makeConfig());
    expect(layout.entityType).toBe('widgets');
    expect(layout.layoutName).toBe('Standard');

    const basics = layout.sections.find((s) => s.name === 'Basics')!;
    expect(basics).toBeDefined();
    expect(basics.fields.map((f) => f.fieldKey)).toEqual(['name', 'status']);
  });

  it('adds an "Unassigned Fields" virtual section for fields not placed in any section', () => {
    const layout = buildInMemoryLayout(makeConfig());
    const unassigned = layout.sections.find((s) => s.name === 'Unassigned Fields');
    expect(unassigned).toBeDefined();
    // priority and assigneeId are not in Basics, system fields are excluded
    expect(unassigned!.fields.map((f) => f.fieldKey)).toEqual(
      expect.arrayContaining(['priority', 'assigneeId']),
    );
    expect(unassigned!.fields.some((f) => f.fieldKey === 'createdAt')).toBe(false);
  });

  it('omits the "Unassigned Fields" section when every field is placed', () => {
    const config = defineEntity({
      table: pgTable('small', {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
      }),
      slug: 'small',
      fields: {
        name: { type: 'text', label: 'Name' },
      },
      sections: [{ name: 'Only', columns: 1, fields: ['name'] }],
      ui: { icon: 'Box' },
    });
    const layout = buildInMemoryLayout(config);
    expect(layout.sections.map((s) => s.name)).toEqual(['Only']);
  });

  it('populates quickCreateFields from fields flagged as isQuickCreate', () => {
    const layout = buildInMemoryLayout(makeConfig());
    expect(layout.quickCreateFields.map((f) => f.fieldKey)).toEqual(['name']);
  });
});
