import { describe, it, expect } from 'vitest';
import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { defineEntity } from '../../define-entity';
import type { ModelDefinition } from '../../define-entity';

// Mock Drizzle table for testing
const testTable = pgTable('test_entities', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  email: text('email'),
  status: text('status').notNull().default('draft'),
  priority: text('priority'),
  assigneeId: text('assignee_id'),
  isActive: boolean('is_active').notNull().default(true),
  amount: integer('amount'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: text('deleted_by'),
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

describe('defineEntity', () => {
  it('should produce a valid EntityConfig from a minimal model', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title', required: true, isLabel: true },
      },
      ui: { icon: 'FileText' },
    });

    expect(config.entityType).toBe('test-entities');
    expect(config.slug).toBe('test-entities');
    expect(config.singularName).toBe('Test-entitie');
    expect(config.pluralName).toBe('Test-entities');
    expect(config.table).toBe(testTable);
    expect(config.ui.icon).toBe('FileText');
    expect(config.ui.nameField).toBe('title');
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
      ui: { icon: 'FileText' },
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
      ui: { icon: 'FileText' },
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
      ui: { icon: 'FileText' },
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
      ui: { icon: 'FileText' },
    });

    expect(config.ui.nameField).toBe('title');
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
      ui: { icon: 'FileText' },
    });

    expect(config.ui.nameField).toEqual(['title', 'email']);
  });

  it('should extract hasMany fields as relationships', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        title: { type: 'text', label: 'Title' },
        applications: {
          type: 'hasMany',
          label: 'Applications',
          entity: 'applications',
          foreignKey: 'testEntityId',
          displayFields: ['name', 'status'],
        },
      },
      ui: { icon: 'FileText' },
    });

    expect(config.relationships).toHaveLength(1);
    expect(config.relationships![0]).toMatchObject({
      name: 'applications',
      type: 'hasMany',
      targetEntity: 'applications',
      foreignKey: 'testEntityId',
      label: 'Applications',
      displayFields: ['name', 'status'],
    });
    // hasMany should NOT appear in fieldMeta
    expect(config.fieldMeta.applications).toBeUndefined();
  });

  it('should convert belongsTo to lookup field type', () => {
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {
        assigneeId: {
          type: 'belongsTo',
          label: 'Assignee',
          entity: 'users',
          lookupLabelField: 'firstName',
          lookupSearchFields: ['firstName', 'lastName'],
        },
      },
      ui: { icon: 'FileText' },
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
      ui: { icon: 'FileText' },
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
      ui: { icon: 'FileText' },
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
      ui: { icon: 'FileText' },
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
      softDelete: true,
      timestamps: true,
      fields: {},
      ui: { icon: 'FileText' },
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

  it('should pass through hooks, actions, extra permissions, and extra events', () => {
    const beforeCreate = async (p: any) => p;
    const config = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: {},
      ui: { icon: 'FileText' },
      extraPermissions: [{ action: 'export', description: 'Export' }],
      extraEvents: [{ name: 'test.custom', description: 'Custom' }],
      hooks: { beforeCreate },
    });

    expect(config.extraPermissions).toEqual([{ action: 'export', description: 'Export' }]);
    expect(config.extraEvents).toEqual([{ name: 'test.custom', description: 'Custom' }]);
    expect(config.hooks?.beforeCreate).toBe(beforeCreate);
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
      ui: { icon: 'FileText' },
    });

    expect(config.sections).toHaveLength(1);
    expect(config.sections[0].name).toBe('Basic Info');
  });

  it('should pass through customFields flag', () => {
    const withFlag = defineEntity({
      table: testTable,
      slug: 'test-entities',
      customFields: true,
      fields: { title: { type: 'text', label: 'Title' } },
      ui: { icon: 'FileText' },
    });
    expect(withFlag.customFields).toBe(true);

    const withoutFlag = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: { title: { type: 'text', label: 'Title' } },
      ui: { icon: 'FileText' },
    });
    expect(withoutFlag.customFields).toBeUndefined();
  });

  it('should pass through adminConfigurable flag', () => {
    const withFlag = defineEntity({
      table: testTable,
      slug: 'test-entities',
      adminConfigurable: true,
      fields: { title: { type: 'text', label: 'Title' } },
      ui: { icon: 'FileText' },
    });
    expect(withFlag.adminConfigurable).toBe(true);

    const withoutFlag = defineEntity({
      table: testTable,
      slug: 'test-entities',
      fields: { title: { type: 'text', label: 'Title' } },
      ui: { icon: 'FileText' },
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
      ui: { icon: 'FileText' },
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
        ui: { icon: 'Folder' },
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
        ui: { icon: 'FileText' },
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
        ui: { icon: 'Folder' },
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
        ui: { icon: 'Folder' },
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
        ui: { icon: 'Folder' },
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
        ui: { icon: 'Folder' },
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
          ui: { icon: 'FileText' },
        }),
      ).toThrow(/hierarchyColumns.*parentId, path, depth/);
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
          ui: { icon: 'Folder' },
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
        ui: { icon: 'Folder' },
      });

      expect(config.systemColumns).not.toContain('parentId');
      expect(config.systemColumns).not.toContain('path');
      expect(config.systemColumns).not.toContain('depth');
      expect(config.hierarchy).toBe(false);
    });
  });
});
