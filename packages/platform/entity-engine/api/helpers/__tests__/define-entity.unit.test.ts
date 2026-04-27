import { describe, it, expect, vi } from 'vitest';
import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { defineEntity } from '../../define-entity';
import type { ModelDefinition } from '../../define-entity';

// Mock Drizzle table for testing. Includes a `customFields` jsonb column so
// `customFields: true` (JSONB mode) passes the shape validation.
const testTable = pgTable('test_entities', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  email: text('email'),
  status: text('status').notNull().default('draft'),
  priority: text('priority'),
  assigneeId: text('assignee_id'),
  isActive: boolean('is_active').notNull().default(true),
  amount: integer('amount'),
  customFields: jsonb('custom_fields').notNull().default({}),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
});

// Table without the custom_fields column, for testing JSONB-mode validation failure.
const tableWithoutCustomFields = pgTable('no_custom_fields_entities', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
});

// Mock hierarchical table — mirrors the shape produced by hierarchyColumns()
// in @packages/hierarchy (parentId/path/depth). Inlined rather than imported
// so this file has no cross-package runtime dependency.
const hierarchicalTable = pgTable('hierarchical_entities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  path: text('path').notNull().default('/'),
  depth: integer('depth').notNull().default(0),
});

// Mock orderable table — mirrors orderableColumns() from @packages/orderable
// (single sort_order integer). Inlined to avoid cross-package runtime coupling.
const orderableTable = pgTable('orderable_entities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

// Mock table that is both hierarchical and orderable (menu_items pattern)
const hierarchicalOrderableTable = pgTable('hierarchical_orderable_entities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  path: text('path').notNull().default('/'),
  depth: integer('depth').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
});

describe('defineEntity', () => {
  it('should produce a valid EntityConfig from a minimal model', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title', required: true, isLabel: true },
      },
    });

    expect(config.entityType).toBe('test-entities');
    expect(config.slug).toBe('test-entities');
    expect(config.singularName).toBe('Test-entitie');
    expect(config.pluralName).toBe('Test-entities');
    expect(config.table).toBe(testTable);
    expect(config.nameField).toBe('title');
    expect(config.fieldMeta.title).toBeDefined();
    expect(config.fieldMeta.title.label).toBe('Title');
  });

  it('should use provided singular/plural names', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      singularName: 'Test Entity',
      pluralName: 'Test Entities',
      fields: {
        title: { type: 'text', label: 'Title' },
      },
    });

    expect(config.singularName).toBe('Test Entity');
    expect(config.pluralName).toBe('Test Entities');
  });

  it('should collect searchable fields into searchColumns', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title', searchable: true },
        email: { type: 'email', label: 'Email', searchable: true },
        status: { type: 'text', label: 'Status' },
      },
    });

    expect(config.searchColumns).toHaveLength(2);
  });

  it('should collect sortable fields into sortableColumns', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title', sortable: true },
        email: { type: 'email', label: 'Email', sortable: true },
      },
    });

    expect(Object.keys(config.sortableColumns)).toContain('title');
    expect(Object.keys(config.sortableColumns)).toContain('email');
  });

  it('should derive nameField from isLabel', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title', isLabel: true },
      },
    });

    expect(config.nameField).toBe('title');
    expect(config.lookup?.labelField).toBe('title');
  });

  it('should support multiple isLabel fields', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title', isLabel: true },
        email: { type: 'email', label: 'Email', isLabel: true },
      },
    });

    expect(config.nameField).toEqual(['title', 'email']);
  });

  it('should pass top-level relationships through to EntityConfig', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title' },
        assigneeId: { type: 'lookup', label: 'Assignee', entity: 'users' },
      },
      relationships: [
        {
          name: 'assignee',
          type: 'belongsTo',
          targetEntity: 'users',
          foreignKey: 'assigneeId',
          label: 'Assignee',
        },
        {
          name: 'applications',
          type: 'hasMany',
          targetEntity: 'applications',
          foreignKey: 'testEntityId',
          label: 'Applications',
          displayFields: ['name', 'status'],
        },
      ],
    });

    expect(config.relationships).toHaveLength(2);
    const byName = Object.fromEntries(config.relationships!.map((r) => [r.name, r]));
    expect(byName.assignee.type).toBe('belongsTo');
    expect(byName.assignee.foreignKey).toBe('assigneeId');
    expect(byName.applications.type).toBe('hasMany');
    // Relations never produce fieldMeta entries under their own name
    expect(config.fieldMeta.assignee).toBeUndefined();
    expect(config.fieldMeta.applications).toBeUndefined();
  });

  it('should produce lookup fieldMeta when a field is declared type: lookup', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        assigneeId: {
          type: 'lookup',
          label: 'Assignee',
          entity: 'users',
          lookupLabelField: 'firstName',
          lookupSearchFields: ['firstName', 'lastName'],
        },
      },
    });

    expect(config.fieldMeta.assigneeId.fieldType).toBe('lookup');
    expect(config.fieldMeta.assigneeId.lookupEntity).toBe('users');
    expect(config.fieldMeta.assigneeId.lookupLabelField).toBe('firstName');
  });

  it('should collect recipient fields', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        assigneeId: { type: 'user', label: 'Assignee', isRecipient: true },
        createdBy: { type: 'user', label: 'Creator', isRecipient: true, system: true },
      },
    });

    expect(config.recipientFields).toEqual({
      assigneeId: { label: 'Assignee' },
      createdBy: { label: 'Creator' },
    });
  });

  it('should collect listVisible fields', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title', listVisible: true },
        email: { type: 'email', label: 'Email', listVisible: true },
        status: { type: 'text', label: 'Status' },
      },
    });

    expect(config.listFields).toEqual(['title', 'email']);
  });

  it('should handle picklist options', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        priority: {
          type: 'picklist',
          label: 'Priority',
          options: [
            { label: 'Low', value: 'low' },
            { label: 'High', value: 'high' },
          ],
        },
      },
    });

    expect(config.fieldMeta.priority.picklistOptions).toEqual([
      { label: 'Low', value: 'low' },
      { label: 'High', value: 'high' },
    ]);
  });

  it('should include only infra columns (id, soft delete) in systemColumns', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      timestamps: true,
      fields: {},
    });

    // Only pure infrastructure columns — id and soft-delete
    expect(config.systemColumns).toContain('id');
    expect(config.systemColumns).toContain('deletedAt');
    expect(config.systemColumns).toContain('deletedBy');
    // createdAt, updatedAt, createdBy are NOT in systemColumns — they are seeded
    // as system/readonly field definitions for conditions and filters
    expect(config.systemColumns).not.toContain('createdAt');
    expect(config.systemColumns).not.toContain('updatedAt');
    expect(config.systemColumns).not.toContain('createdBy');
  });

  it('should pass through actions, extra permissions, and extra events', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {},
      extraPermissions: [{ action: 'export', description: 'Export' }],
      extraEvents: [{ name: 'test.custom', description: 'Custom' }],
    });

    expect(config.extraPermissions).toEqual([{ action: 'export', description: 'Export' }]);
    expect(config.extraEvents).toEqual([{ name: 'test.custom', description: 'Custom' }]);
  });

  it('should pass through sections for entity-layout', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title' },
      },
      sections: [
        { name: 'Basic Info', fields: ['title'] },
      ],
    });

    expect(config.sections).toHaveLength(1);
    expect(config.sections[0].name).toBe('Basic Info');
  });

  describe('customFields mode', () => {
    it('should pass through customFields: true (JSONB mode) when the table has the column', () => {
      const config = defineEntity({
        table: testTable,
        slug: 'test-entities',
        customFields: true,
        fields: { title: { type: 'text', label: 'Title' } },
        });
      expect(config.customFields).toBe(true);
    });

    it('should register customFields as a system column in JSONB mode', () => {
      const config = defineEntity({
        table: testTable,
        slug: 'test-entities',
        customFields: true,
        fields: { title: { type: 'text', label: 'Title' } },
        });
      expect(config.systemColumns).toContain('customFields');
    });

    it("should pass through customFields: 'eav' without requiring the column", () => {
      const config = defineEntity({
        table: tableWithoutCustomFields,
        slug: 'eav-entities',
        customFields: 'eav',
        fields: { title: { type: 'text', label: 'Title' } },
        });
      expect(config.customFields).toBe('eav');
      expect(config.systemColumns).not.toContain('customFields');
    });

    it("should leave customFields undefined when the flag is absent", () => {
      const config = defineEntity({
        table: testTable,
        slug: 'test-entities',
        fields: { title: { type: 'text', label: 'Title' } },
        });
      expect(config.customFields).toBeUndefined();
      expect(config.systemColumns).not.toContain('customFields');
    });

    it("should accept customFields: false explicitly", () => {
      const config = defineEntity({
        table: tableWithoutCustomFields,
        slug: 'no-custom',
        customFields: false,
        fields: { title: { type: 'text', label: 'Title' } },
        });
      expect(config.customFields).toBe(false);
      expect(config.systemColumns).not.toContain('customFields');
    });

    it("should throw when customFields: true but the table is missing customFieldsColumn()", () => {
      expect(() =>
        defineEntity({
          table: tableWithoutCustomFields,
          slug: 'missing-jsonb',
          customFields: true,
          fields: { title: { type: 'text', label: 'Title' } },
            }),
      ).toThrow(/customFieldsColumn.*Missing customFields column/);
    });
  });

  it('should pass through adminConfigurable flag', () => {
    const withFlag = defineEntity({
      table: testTable,
      slug: 'test-entities',
      adminConfigurable: true,
      fields: { title: { type: 'text', label: 'Title' } },
    });
    expect(withFlag.adminConfigurable).toBe(true);

    const withoutFlag = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: { title: { type: 'text', label: 'Title' } },
    });
    expect(withoutFlag.adminConfigurable).toBeUndefined();
  });

  it('should set default sort and ensure it is sortable', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      defaultSort: 'title',
      fields: {
        title: { type: 'text', label: 'Title' },
      },
    });

    expect(config.defaultSort).toBe('title');
    expect(config.sortableColumns.title).toBeDefined();
  });

  describe('hierarchy flag', () => {
    it('should surface hierarchy: true on the returned config when flag is set', () => {
      const config = defineEntity({
        table: hierarchicalTable,
        slug: 'hierarchical-entities',
        hierarchy: true,
        fields: {
          name: { type: 'text', label: 'Name', required: true, isLabel: true },
        },
      });

      expect(config.hierarchy).toBe(true);
    });

    it('should leave hierarchy undefined when flag is absent', () => {
      const config = defineEntity({
        table: testTable,
        slug: 'test-entities',
        fields: {
          title: { type: 'text', label: 'Title' },
        },
        });

      expect(config.hierarchy).toBeUndefined();
    });

    it('should register path and depth (but not parentId) as system columns when hierarchy is true', () => {
      const config = defineEntity({
        table: hierarchicalTable,
        slug: 'hierarchical-entities',
        hierarchy: true,
        fields: {
          name: { type: 'text', label: 'Name' },
        },
      });

      expect(config.systemColumns).toContain('path');
      expect(config.systemColumns).toContain('depth');
      // parentId is user-editable — seeded as a lookup field, not a system column
      expect(config.systemColumns).not.toContain('parentId');
    });

    it('should auto-inject parentId as a self-lookup field when hierarchy is true', () => {
      const config = defineEntity({
        table: hierarchicalTable,
        slug: 'hierarchical-entities',
        singularName: 'Folder',
        pluralName: 'Folders',
        hierarchy: true,
        fields: {
          name: { type: 'text', label: 'Name', isLabel: true },
        },
      });

      expect(config.fieldMeta.parentId).toBeDefined();
      expect(config.fieldMeta.parentId.fieldType).toBe('lookup');
      expect(config.fieldMeta.parentId.lookupEntity).toBe('hierarchical-entities');
      expect(config.fieldMeta.parentId.lookupLabelField).toBe('name');
      expect(config.fieldMeta.parentId.isSystem).toBe(true);
      expect(config.fieldMeta.parentId.label).toBe('Parent Folder');
    });

    it('should not auto-inject parentId when the consumer declares it explicitly', () => {
      const config = defineEntity({
        table: hierarchicalTable,
        slug: 'hierarchical-entities',
        hierarchy: true,
        fields: {
          name: { type: 'text', label: 'Name' },
          parentId: { type: 'lookup', label: 'Custom Parent', entity: 'hierarchical-entities' },
        },
      });

      expect(config.fieldMeta.parentId.label).toBe('Custom Parent');
    });

    it('should not auto-inject parentId when hierarchy is false', () => {
      const config = defineEntity({
        table: hierarchicalTable,
        slug: 'hierarchical-entities',
        hierarchy: false,
        fields: {
          name: { type: 'text', label: 'Name' },
        },
      });

      expect(config.fieldMeta.parentId).toBeUndefined();
    });

    it('should throw when hierarchy: true but the table is missing hierarchyColumns()', () => {
      expect(() =>
        defineEntity({
          table: testTable, // has no parentId/path/depth
          slug: 'test-entities',
          hierarchy: true,
          fields: {
            title: { type: 'text', label: 'Title' },
          },
            }),
      ).toThrow(/hierarchy: true.*parentId, path, depth/);
    });

    it('should throw and list only the missing hierarchy columns', () => {
      const partialTable = pgTable('partial_hierarchical', {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        parentId: text('parent_id'),
        // path and depth intentionally missing
      });

      expect(() =>
        defineEntity({
          table: partialTable,
          slug: 'partial-hierarchical',
          hierarchy: true,
          fields: {
            name: { type: 'text', label: 'Name' },
          },
          }),
      ).toThrow(/Missing columns: path, depth/);
    });

    it('should not add hierarchy columns to systemColumns when flag is false', () => {
      const config = defineEntity({
        table: hierarchicalTable,
        slug: 'hierarchical-entities',
        hierarchy: false,
        fields: {
          name: { type: 'text', label: 'Name' },
        },
      });

      expect(config.systemColumns).not.toContain('parentId');
      expect(config.systemColumns).not.toContain('path');
      expect(config.systemColumns).not.toContain('depth');
      expect(config.hierarchy).toBe(false);
    });
  });

  describe('extensionOf / extensionColumns', () => {
    // Shared-key extension shape: primary key IS the FK to the parent.
    // Mirrors the shape used by `compliance_tasks.task_id` today.
    const extensionTable = pgTable('ext_entities', {
      taskId: text('task_id').primaryKey(),
      ruleId: text('rule_id').notNull(),
      periodStart: text('period_start').notNull(),
    });

    const nonPkFkTable = pgTable('ext_entities_nonpk', {
      id: text('id').primaryKey(),
      taskId: text('task_id').notNull(),
      ruleId: text('rule_id').notNull(),
    });

    const nullableFkTable = pgTable('ext_entities_nullable', {
      taskId: text('task_id'), // nullable, not primary
      ruleId: text('rule_id').notNull(),
    });

    it('should pass extensionColumns through on the parent entity', () => {
      const config = defineEntity({
        table: testTable,
        slug: 'test-entities',
        extensionColumns: ['title', 'status', 'priority'],
        fields: {
          title: { type: 'text', label: 'Title' },
          status: { type: 'text', label: 'Status' },
          priority: { type: 'text', label: 'Priority' },
        },
        });

      expect(config.extensionColumns).toEqual(['title', 'status', 'priority']);
    });

    it('should pass extensionOf through on the child entity', () => {
      const config = defineEntity({
        table: extensionTable,
        slug: 'ext-entities',
        extensionOf: {
          entity: 'test-entities',
          foreignKey: 'taskId',
          excludeColumns: ['createdAt'],
          extraColumns: ['email'],
          parentDefaults: { kind: 'test' },
        },
        fields: {
          ruleId: { type: 'text', label: 'Rule' },
        },
        });

      expect(config.extensionOf).toEqual({
        entity: 'test-entities',
        foreignKey: 'taskId',
        excludeColumns: ['createdAt'],
        extraColumns: ['email'],
        parentDefaults: { kind: 'test' },
      });
    });

    it('should leave both undefined when neither is set', () => {
      const config = defineEntity({
        table: testTable,
        slug: 'test-entities',
        fields: { title: { type: 'text', label: 'Title' } },
        });

      expect(config.extensionColumns).toBeUndefined();
      expect(config.extensionOf).toBeUndefined();
    });

    it('should throw when both extensionOf and extensionColumns are set', () => {
      expect(() =>
        defineEntity({
          table: extensionTable,
          slug: 'ext-entities',
          extensionColumns: ['ruleId'],
          extensionOf: { entity: 'test-entities', foreignKey: 'taskId' },
          fields: { ruleId: { type: 'text', label: 'Rule' } },
            }),
      ).toThrow(/both 'extensionOf' and 'extensionColumns'/);
    });

    it('should throw when extensionOf.foreignKey is missing', () => {
      expect(() =>
        defineEntity({
          table: extensionTable,
          slug: 'ext-entities',
          extensionOf: { entity: 'test-entities', foreignKey: '' },
          fields: { ruleId: { type: 'text', label: 'Rule' } },
            }),
      ).toThrow(/extensionOf\.foreignKey must be a non-empty string/);
    });

    it('should throw when extensionOf.foreignKey names a column that does not exist', () => {
      expect(() =>
        defineEntity({
          table: extensionTable,
          slug: 'ext-entities',
          extensionOf: { entity: 'test-entities', foreignKey: 'nope' },
          fields: { ruleId: { type: 'text', label: 'Rule' } },
            }),
      ).toThrow(/foreignKey 'nope' is not a column/);
    });

    it('should throw when extensionOf.foreignKey is not the primary key', () => {
      expect(() =>
        defineEntity({
          table: nonPkFkTable,
          slug: 'ext-entities-nonpk',
          extensionOf: { entity: 'test-entities', foreignKey: 'taskId' },
          fields: { ruleId: { type: 'text', label: 'Rule' } },
            }),
      ).toThrow(/must be the primary key/);
    });

    it('should throw when extensionOf.foreignKey is nullable', () => {
      expect(() =>
        defineEntity({
          table: nullableFkTable,
          slug: 'ext-entities-nullable',
          extensionOf: { entity: 'test-entities', foreignKey: 'taskId' },
          fields: { ruleId: { type: 'text', label: 'Rule' } },
            }),
      ).toThrow(/must be the primary key|must be NOT NULL/);
    });

    it('should throw when extensionColumns names a column that does not exist', () => {
      expect(() =>
        defineEntity({
          table: testTable,
          slug: 'test-entities',
          extensionColumns: ['title', 'nope'],
          fields: { title: { type: 'text', label: 'Title' } },
            }),
      ).toThrow(/extensionColumns includes 'nope'/);
    });

    it('should throw when extensionOf.parentDefaults is not a plain object', () => {
      expect(() =>
        defineEntity({
          table: extensionTable,
          slug: 'ext-entities',
          extensionOf: {
            entity: 'test-entities',
            foreignKey: 'taskId',
            parentDefaults: ['oops'] as unknown as Record<string, unknown>,
          },
          fields: { ruleId: { type: 'text', label: 'Rule' } },
            }),
      ).toThrow(/parentDefaults must be a plain object/);
    });

    it('marks deletedAt/deletedBy as system columns on an extension child even without its own softDeleteColumns', () => {
      // The parent owns the columns; the child surfaces them via the
      // resolved extension projection. Listing them as system columns
      // keeps them out of snapshots and forms.
      const config = defineEntity({
        table: extensionTable,
        slug: 'ext-entities',
        extensionOf: { entity: 'test-entities', foreignKey: 'taskId' },
        fields: { ruleId: { type: 'text', label: 'Rule' } },
        });

      expect(config.systemColumns).toContain('deletedAt');
      expect(config.systemColumns).toContain('deletedBy');
    });
  });

  describe('orderable flag', () => {
    it('surfaces orderable: true on the returned config', () => {
      const config = defineEntity({
        table: orderableTable,
        slug: 'orderable-entities',
        orderable: true,
        fields: {
          name: { type: 'text', label: 'Name', isLabel: true },
        },
      });

      expect(config.orderable).toBe(true);
    });

    it('leaves orderable undefined when the flag is absent', () => {
      const config = defineEntity({
        table: testTable,
        slug: 'test-entities',
        fields: { title: { type: 'text', label: 'Title' } },
        });

      expect(config.orderable).toBeUndefined();
    });

    it('registers sortOrder as a system column so it is hidden from forms/seeds', () => {
      const config = defineEntity({
        table: orderableTable,
        slug: 'orderable-entities',
        orderable: true,
        fields: { name: { type: 'text', label: 'Name' } },
      });

      expect(config.systemColumns).toContain('sortOrder');
    });

    it('defaults list sort to sortOrder when orderable and no defaultSort given', () => {
      const config = defineEntity({
        table: orderableTable,
        slug: 'orderable-entities',
        orderable: true,
        fields: { name: { type: 'text', label: 'Name' } },
      });

      expect(config.defaultSort).toBe('sortOrder');
      expect(config.sortableColumns.sortOrder).toBeDefined();
    });

    it('honours an explicit defaultSort over the orderable default', () => {
      const config = defineEntity({
        table: orderableTable,
        slug: 'orderable-entities',
        orderable: true,
        defaultSort: 'name',
        fields: { name: { type: 'text', label: 'Name', sortable: true } },
      });

      expect(config.defaultSort).toBe('name');
    });

    it('throws when orderable: true but the table is missing orderableColumns()', () => {
      expect(() =>
        defineEntity({
          table: testTable,
          slug: 'test-entities',
          orderable: true,
          fields: { title: { type: 'text', label: 'Title' } },
            }),
      ).toThrow(/orderable: true.*sortOrder/);
    });

    it('supports combining hierarchy and orderable on one entity', () => {
      const config = defineEntity({
        table: hierarchicalOrderableTable,
        slug: 'menu-items',
        hierarchy: true,
        orderable: true,
        fields: { name: { type: 'text', label: 'Name', isLabel: true } },
      });

      expect(config.hierarchy).toBe(true);
      expect(config.orderable).toBe(true);
      expect(config.systemColumns).toContain('path');
      expect(config.systemColumns).toContain('depth');
      expect(config.systemColumns).toContain('sortOrder');
      expect(config.fieldMeta.parentId).toBeDefined();
    });
  });
});
