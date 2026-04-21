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
    onDelete: { mode: 'soft' },
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
      assigneeId: { type: 'lookup', label: 'Assignee', entity: 'users' },
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
      onDelete: { mode: 'hard' },
      slug: 'empty',
      fields: {},
      ui: { icon: 'Box' },
    });
    expect(buildInMemoryFields(emptyConfig)).toEqual([]);
  });

  it('honours computedColumns as additional skip entries', () => {
    const config = defineEntity({
      table: testTable,
      onDelete: { mode: 'soft' },
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
      onDelete: { mode: 'hard' },
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

describe('extensionOf support', () => {
  // Parent table used as the "generic" base (e.g. tasks) that an extension
  // child (e.g. compliance_tasks) projects fields from.
  const parentTable = pgTable('parent_items', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    status: text('status').notNull().default('open'),
    priority: integer('priority'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  });

  const childTable = pgTable('child_items', {
    id: text('id').primaryKey(),
    parentId: text('parent_id').notNull(),
    ruleId: text('rule_id'),
    severity: text('severity'),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  });

  function makeParentConfig() {
    return defineEntity({
      table: parentTable,
      onDelete: { mode: 'hard' },
      slug: 'parent-items',
      fields: {
        title: { type: 'text', label: 'Title', required: true },
        status: { type: 'text', label: 'Status' },
        priority: { type: 'number', label: 'Priority' },
      },
      ui: { icon: 'Box' },
    });
  }

  function makeChildConfig() {
    return defineEntity({
      table: childTable,
      onDelete: { mode: 'hard' },
      slug: 'child-items',
      fields: {
        ruleId: { type: 'text', label: 'Rule' },
        severity: { type: 'text', label: 'Severity' },
      },
      ui: { icon: 'Box' },
    });
  }

  it('appends parent projected fields after the child\'s own fields', () => {
    const fields = buildInMemoryFields(makeChildConfig(), {
      parentConfig: makeParentConfig(),
      projectedKeys: ['title', 'status'],
    });

    const keys = fields.map((f) => f.fieldKey);
    expect(keys).toContain('ruleId');
    expect(keys).toContain('severity');
    expect(keys).toContain('title');
    expect(keys).toContain('status');
    expect(keys).not.toContain('priority');
  });

  it('retains parent field metadata (picklist options, label, fieldType)', () => {
    const parentWithPicklist = defineEntity({
      table: parentTable,
      onDelete: { mode: 'hard' },
      slug: 'parent-items',
      fields: {
        title: { type: 'text', label: 'Title' },
        status: {
          type: 'picklist',
          label: 'Status',
          options: [
            { label: 'Open', value: 'open', isDefault: true },
            { label: 'Done', value: 'done' },
          ],
        },
      },
      ui: { icon: 'Box' },
    });

    const fields = buildInMemoryFields(makeChildConfig(), {
      parentConfig: parentWithPicklist,
      projectedKeys: ['status'],
    });
    const status = fields.find((f) => f.fieldKey === 'status')!;
    expect(status.label).toBe('Status');
    expect(status.fieldType).toBe('picklist');
    expect(status.picklistOptions.map((o) => o.value)).toEqual(['open', 'done']);
  });

  it('child field with the same fieldKey shadows the parent projection', () => {
    const childWithOverride = defineEntity({
      table: childTable,
      onDelete: { mode: 'hard' },
      slug: 'child-items',
      fields: {
        // Child re-declares status with a different label
        status: { type: 'text', label: 'Child Status' },
      },
      ui: { icon: 'Box' },
    });

    const fields = buildInMemoryFields(childWithOverride, {
      parentConfig: makeParentConfig(),
      projectedKeys: ['title', 'status'],
    });
    const statusFields = fields.filter((f) => f.fieldKey === 'status');
    expect(statusFields).toHaveLength(1);
    expect(statusFields[0].label).toBe('Child Status');
    // Title still flows through from parent
    expect(fields.some((f) => f.fieldKey === 'title')).toBe(true);
  });

  it('places parent projected fields in Unassigned when the child layout does not reference them', () => {
    const layout = buildInMemoryLayout(makeChildConfig(), 'Standard', {
      parentConfig: makeParentConfig(),
      projectedKeys: ['title', 'status'],
    });

    const unassigned = layout.sections.find((s) => s.name === 'Unassigned Fields')!;
    expect(unassigned).toBeDefined();
    const keys = unassigned.fields.map((f) => f.fieldKey);
    expect(keys).toEqual(expect.arrayContaining(['title', 'status', 'ruleId', 'severity']));
  });

  it('allows child sections to reference parent projected fields by fieldKey', () => {
    const childWithSections = defineEntity({
      table: childTable,
      onDelete: { mode: 'hard' },
      slug: 'child-items',
      fields: {
        ruleId: { type: 'text', label: 'Rule' },
        severity: { type: 'text', label: 'Severity' },
      },
      sections: [
        { name: 'Overview', columns: 2, fields: ['title', 'status', 'ruleId'] },
      ],
      ui: { icon: 'Box' },
    });

    const layout = buildInMemoryLayout(childWithSections, 'Standard', {
      parentConfig: makeParentConfig(),
      projectedKeys: ['title', 'status'],
    });

    const overview = layout.sections.find((s) => s.name === 'Overview')!;
    expect(overview.fields.map((f) => f.fieldKey)).toEqual(['title', 'status', 'ruleId']);
    // severity remains unplaced
    const unassigned = layout.sections.find((s) => s.name === 'Unassigned Fields')!;
    expect(unassigned.fields.map((f) => f.fieldKey)).toContain('severity');
    // title and status were placed, so they should NOT appear in Unassigned
    expect(unassigned.fields.map((f) => f.fieldKey)).not.toContain('title');
    expect(unassigned.fields.map((f) => f.fieldKey)).not.toContain('status');
  });

  it('skips projected keys that do not exist on the parent config', () => {
    const fields = buildInMemoryFields(makeChildConfig(), {
      parentConfig: makeParentConfig(),
      projectedKeys: ['title', 'nonexistent'],
    });
    const keys = fields.map((f) => f.fieldKey);
    expect(keys).toContain('title');
    expect(keys).not.toContain('nonexistent');
  });
});
