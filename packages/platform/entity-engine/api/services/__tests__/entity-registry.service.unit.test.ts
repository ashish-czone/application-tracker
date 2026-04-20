import { describe, it, expect, beforeEach } from 'vitest';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { EntityRegistryService } from '../../entity-registry.service';
import type { EntityConfig } from '../../types';

function mockConfig(overrides: Partial<EntityConfig> = {}): EntityConfig {
  return {
    entityType: 'test_entity',
    singularName: 'Test Entity',
    pluralName: 'Test Entities',
    slug: 'test-entities',
    table: {} as any,
    systemColumns: ['id', 'deletedAt', 'deletedBy'],
    onDelete: { mode: 'soft' },
    searchColumns: [],
    defaultSort: 'createdAt',
    sortableColumns: {},
    fieldMeta: {},
    sections: [],
    ui: {
      icon: 'box',
      nameField: 'name',
    },
    ...overrides,
  };
}

describe('EntityRegistryService', () => {
  let registry: EntityRegistryService;

  beforeEach(() => {
    registry = new EntityRegistryService();
  });

  it('registers and retrieves an entity config', () => {
    const config = mockConfig();
    registry.register(config);

    expect(registry.get('test_entity')).toBe(config);
    expect(registry.size).toBe(1);
  });

  it('throws on duplicate registration', () => {
    registry.register(mockConfig());

    expect(() => registry.register(mockConfig())).toThrow(
      'Entity type "test_entity" is already registered',
    );
  });

  it('returns undefined for unknown entity type', () => {
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('getOrFail throws for unknown entity type', () => {
    expect(() => registry.getOrFail('unknown')).toThrow(
      'Entity type "unknown" is not registered',
    );
  });

  it('getBySlug finds entity by slug', () => {
    const config = mockConfig({ slug: 'my-entities' });
    registry.register(config);

    expect(registry.getBySlug('my-entities')).toBe(config);
    expect(registry.getBySlug('other')).toBeUndefined();
  });

  it('getAll returns all registered configs', () => {
    const config1 = mockConfig({ entityType: 'entity_a', slug: 'entity-a' });
    const config2 = mockConfig({ entityType: 'entity_b', slug: 'entity-b' });

    registry.register(config1);
    registry.register(config2);

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getAll()).toContain(config1);
    expect(registry.getAll()).toContain(config2);
  });

  it('getRegistryEntries returns serializable entries', () => {
    registry.register(mockConfig({
      entityType: 'candidates',
      singularName: 'Candidate',
      pluralName: 'Candidates',
      slug: 'candidates',
      table: { deletedAt: {} } as any,
      ui: { icon: 'users', nameField: ['firstName', 'lastName'] },
      fieldMeta: {
        skills: { label: 'Skills', section: 'details', sortOrder: 0, fieldType: 'tags', tagGroupSlug: 'candidate-skills' },
      },
      relationships: [
        {
          name: 'applications',
          type: 'hasMany',
          targetEntity: 'applications',
          foreignKey: 'candidateId',
          label: 'Applications',
          displayFields: ['jobTitle', 'status'],
        },
      ],
    }));

    const entries = registry.getRegistryEntries();
    expect(entries).toHaveLength(1);

    const entry = entries[0];
    expect(entry.entityType).toBe('candidates');
    expect(entry.slug).toBe('candidates');
    expect(entry.ui.icon).toBe('users');
    expect(entry.features.softDelete).toBe(true);
    expect(entry.features.hasTaxonomy).toBe(true);
    expect(entry.features.hasWorkflow).toBe(false);
    expect(entry.relationships).toHaveLength(1);
    expect(entry.relationships[0].name).toBe('applications');
    // foreignKey IS serialized (needed for related list filtering)
    expect(entry.relationships[0].foreignKey).toBe('candidateId');
  });

  it('derives softDelete feature from onDelete.mode', () => {
    registry.register(mockConfig({ onDelete: { mode: 'soft' } }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.softDelete).toBe(true);
    expect(entries[0].features.restore).toBe(true);
  });

  it('softDelete feature is false when onDelete.mode is not soft', () => {
    registry.register(mockConfig({ onDelete: { mode: 'hard' } }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.softDelete).toBe(false);
    expect(entries[0].features.restore).toBe(false);
  });

  it('derives hasMedia from fieldMeta', () => {
    registry.register(mockConfig({
      fieldMeta: {
        resume: { label: 'Resume', section: 'attachments', sortOrder: 0, fieldType: 'file' },
      },
    }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.hasMedia).toBe(true);
  });

  it('exposes customFields flag in features', () => {
    registry.register(mockConfig({
      entityType: 'with_custom',
      slug: 'with-custom',
      customFields: true,
    }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.customFields).toBe(true);
  });

  it('customFields defaults to false in features', () => {
    registry.register(mockConfig());

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.customFields).toBe(false);
  });

  it('exposes hasNotes flag in features', () => {
    registry.register(mockConfig({
      entityType: 'with_notes',
      slug: 'with-notes',
      hasNotes: true,
    }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.hasNotes).toBe(true);
  });

  it('hasNotes defaults to false in features', () => {
    registry.register(mockConfig());

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.hasNotes).toBe(false);
  });

  it('exposes hasAttachments flag and config in features', () => {
    registry.register(mockConfig({
      entityType: 'with_attachments',
      slug: 'with-attachments',
      hasAttachments: true,
      attachmentConfig: {
        maxFileSize: 5 * 1024 * 1024,
        acceptedMimeTypes: ['image/*', 'application/pdf'],
        deleteMode: 'hard',
      },
    }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.hasAttachments).toBe(true);
    expect(entries[0].features.attachmentConfig).toEqual({
      maxFileSize: 5 * 1024 * 1024,
      acceptedMimeTypes: ['image/*', 'application/pdf'],
      deleteMode: 'hard',
    });
  });

  it('hasAttachments defaults to false in features', () => {
    registry.register(mockConfig());

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.hasAttachments).toBe(false);
    expect(entries[0].features.attachmentConfig).toBeUndefined();
  });

  it('exposes hasEvaluations flag in features', () => {
    registry.register(mockConfig({
      entityType: 'with_evaluations',
      slug: 'with-evaluations',
      hasEvaluations: true,
    }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.hasEvaluations).toBe(true);
  });

  it('hasEvaluations defaults to false in features', () => {
    registry.register(mockConfig());

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.hasEvaluations).toBe(false);
  });

  it('exposes adminConfigurable flag in features', () => {
    registry.register(mockConfig({
      entityType: 'with_admin',
      slug: 'with-admin',
      adminConfigurable: true,
    }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.adminConfigurable).toBe(true);
  });

  it('adminConfigurable defaults to false in features', () => {
    registry.register(mockConfig());

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.adminConfigurable).toBe(false);
  });

  it('exposes hasTags groupSlug in features when set', () => {
    registry.register(mockConfig({
      entityType: 'with_tags',
      slug: 'with-tags',
      hasTags: { groupSlug: 'task-tags' },
    }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.hasTags).toEqual({ groupSlug: 'task-tags' });
  });

  it('hasTags defaults to undefined in features', () => {
    registry.register(mockConfig());

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.hasTags).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // extensionOf resolution (finalize / getResolvedExtension)
  // ---------------------------------------------------------------------------

  describe('extensionOf resolution', () => {
    // Real Drizzle tables — finalize() walks columns via getTableColumns().
    const parentTable = pgTable('parent_entities', {
      id: text('id').primaryKey(),
      title: text('title').notNull(),
      status: text('status').notNull(),
      priority: text('priority'),
      kind: text('kind').notNull(),                                 // discriminator (not projected)
      externalKey: text('external_key'),                            // platform plumbing (not projected)
      createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    });

    const childTable = pgTable('child_entities', {
      taskId: text('task_id').primaryKey(),
      ruleId: text('rule_id').notNull(),
      periodStart: text('period_start').notNull(),
    });

    const otherChildTable = pgTable('other_child_entities', {
      taskId: text('task_id').primaryKey(),
    });

    function parentConfig(extensionColumns?: string[], overrides: Partial<EntityConfig> = {}): EntityConfig {
      return mockConfig({
        entityType: 'parent_entities',
        slug: 'parent-entities',
        table: parentTable as unknown as EntityConfig['table'],
        extensionColumns,
        ...overrides,
      });
    }

    function childConfig(extensionOf: NonNullable<EntityConfig['extensionOf']>, overrides: Partial<EntityConfig> = {}): EntityConfig {
      return mockConfig({
        entityType: 'child_entities',
        slug: 'child-entities',
        table: childTable as unknown as EntityConfig['table'],
        extensionOf,
        ...overrides,
      });
    }

    it('resolves the parent projection when no exclude/extra is set', () => {
      registry.register(parentConfig(['title', 'status', 'priority']));
      registry.register(childConfig({ entity: 'parent_entities', foreignKey: 'taskId' }));
      registry.finalize();

      const resolved = registry.getResolvedExtension('child_entities');
      expect(resolved).toBeDefined();
      expect(resolved!.parentEntityType).toBe('parent_entities');
      expect(resolved!.parentTable).toBe(parentTable);
      expect(resolved!.foreignKeyColumn).toBe(childTable.taskId);
      expect(resolved!.parentIdColumn).toBe(parentTable.id);
      expect(resolved!.projectedColumns.map((p) => p.fieldKey)).toEqual(['title', 'status', 'priority']);
      expect(resolved!.parentDefaults).toEqual({});
    });

    it('drops a column listed in excludeColumns', () => {
      registry.register(parentConfig(['title', 'status', 'priority']));
      registry.register(childConfig({ entity: 'parent_entities', foreignKey: 'taskId', excludeColumns: ['priority'] }));
      registry.finalize();

      const resolved = registry.getResolvedExtension('child_entities')!;
      expect(resolved.projectedColumns.map((p) => p.fieldKey)).toEqual(['title', 'status']);
    });

    it('appends extraColumns after the parent projection in declared order', () => {
      registry.register(parentConfig(['title']));
      registry.register(
        childConfig({ entity: 'parent_entities', foreignKey: 'taskId', extraColumns: ['createdAt', 'kind'] }),
      );
      registry.finalize();

      const resolved = registry.getResolvedExtension('child_entities')!;
      expect(resolved.projectedColumns.map((p) => p.fieldKey)).toEqual(['title', 'createdAt', 'kind']);
    });

    it('combines excludeColumns and extraColumns', () => {
      registry.register(parentConfig(['title', 'status', 'priority']));
      registry.register(
        childConfig({
          entity: 'parent_entities',
          foreignKey: 'taskId',
          excludeColumns: ['priority'],
          extraColumns: ['kind'],
        }),
      );
      registry.finalize();

      const resolved = registry.getResolvedExtension('child_entities')!;
      expect(resolved.projectedColumns.map((p) => p.fieldKey)).toEqual(['title', 'status', 'kind']);
    });

    it('passes parentDefaults through verbatim', () => {
      registry.register(parentConfig(['title']));
      registry.register(
        childConfig({ entity: 'parent_entities', foreignKey: 'taskId', parentDefaults: { kind: 'compliance' } }),
      );
      registry.finalize();

      const resolved = registry.getResolvedExtension('child_entities')!;
      expect(resolved.parentDefaults).toEqual({ kind: 'compliance' });
    });

    it('returns undefined for non-extension entities', () => {
      registry.register(mockConfig());
      registry.finalize();
      expect(registry.getResolvedExtension('test_entity')).toBeUndefined();
    });

    it('finalize is idempotent', () => {
      registry.register(parentConfig(['title']));
      registry.register(childConfig({ entity: 'parent_entities', foreignKey: 'taskId' }));
      registry.finalize();
      const before = registry.getResolvedExtension('child_entities');

      registry.finalize();
      const after = registry.getResolvedExtension('child_entities');

      expect(after).toBe(before);
    });

    it('throws when an extension entity is queried before finalize()', () => {
      registry.register(parentConfig(['title']));
      registry.register(childConfig({ entity: 'parent_entities', foreignKey: 'taskId' }));

      expect(() => registry.getResolvedExtension('child_entities')).toThrow(/before finalize/);
    });

    it('returns undefined for non-extension entities even before finalize()', () => {
      registry.register(mockConfig());
      expect(registry.getResolvedExtension('test_entity')).toBeUndefined();
    });

    it('returns undefined for unknown entities even before finalize()', () => {
      expect(registry.getResolvedExtension('never_registered')).toBeUndefined();
    });

    it('throws when the parent entity is not registered', () => {
      registry.register(childConfig({ entity: 'parent_entities', foreignKey: 'taskId' }));

      expect(() => registry.finalize()).toThrow(
        /Entity 'child_entities' declares extensionOf 'parent_entities', but 'parent_entities' is not registered/,
      );
    });

    it('throws when the parent declares its own extensionOf (chaining)', () => {
      // Parent that itself extends another entity
      const grandparent = mockConfig({
        entityType: 'grandparent',
        slug: 'grandparent',
        table: parentTable as unknown as EntityConfig['table'],
        extensionColumns: ['title'],
      });
      const middleTable = pgTable('middle_entities', {
        taskId: text('task_id').primaryKey(),
      });
      const middle = mockConfig({
        entityType: 'parent_entities',
        slug: 'parent-entities',
        table: middleTable as unknown as EntityConfig['table'],
        extensionOf: { entity: 'grandparent', foreignKey: 'taskId' },
      });
      registry.register(grandparent);
      registry.register(middle);
      registry.register(childConfig({ entity: 'parent_entities', foreignKey: 'taskId' }));

      expect(() => registry.finalize()).toThrow(
        /Extension chaining is not supported/,
      );
    });

    it('throws when parent does not declare extensionColumns', () => {
      registry.register(parentConfig(undefined));
      registry.register(childConfig({ entity: 'parent_entities', foreignKey: 'taskId' }));

      expect(() => registry.finalize()).toThrow(
        /does not declare any 'extensionColumns'/,
      );
    });

    it('throws when extraColumns names a parent column that does not exist', () => {
      registry.register(parentConfig(['title']));
      registry.register(
        childConfig({ entity: 'parent_entities', foreignKey: 'taskId', extraColumns: ['nope'] }),
      );

      expect(() => registry.finalize()).toThrow(
        /extraColumns names 'nope', which is not a column on 'parent_entities'/,
      );
    });

    it('throws when extraColumns duplicates a column already in extensionColumns', () => {
      registry.register(parentConfig(['title']));
      registry.register(
        childConfig({ entity: 'parent_entities', foreignKey: 'taskId', extraColumns: ['title'] }),
      );

      expect(() => registry.finalize()).toThrow(
        /extraColumns names 'title', which is already in 'parent_entities'\.extensionColumns/,
      );
    });

    it('throws when excludeColumns names a column not in extensionColumns', () => {
      registry.register(parentConfig(['title', 'status']));
      registry.register(
        childConfig({ entity: 'parent_entities', foreignKey: 'taskId', excludeColumns: ['priority'] }),
      );

      expect(() => registry.finalize()).toThrow(
        /excludeColumns names 'priority', which is not in 'parent_entities'\.extensionColumns/,
      );
    });

    it('resolves multiple extensions of the same parent independently', () => {
      registry.register(parentConfig(['title', 'status']));
      registry.register(childConfig({ entity: 'parent_entities', foreignKey: 'taskId' }));
      registry.register(
        mockConfig({
          entityType: 'other_child_entities',
          slug: 'other-child-entities',
          table: otherChildTable as unknown as EntityConfig['table'],
          extensionOf: { entity: 'parent_entities', foreignKey: 'taskId', excludeColumns: ['status'] },
        }),
      );
      registry.finalize();

      expect(registry.getResolvedExtension('child_entities')!.projectedColumns.map((p) => p.fieldKey)).toEqual([
        'title',
        'status',
      ]);
      expect(registry.getResolvedExtension('other_child_entities')!.projectedColumns.map((p) => p.fieldKey)).toEqual([
        'title',
      ]);
    });
  });
});
