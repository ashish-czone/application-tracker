import { describe, it, expect, beforeEach } from 'vitest';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@packages/soft-delete';
import { EntityRegistryService } from '../../entity-registry.service';
import { FeatureDeriverRegistry } from '../feature-deriver.registry';
import type { EntityConfig } from '../../types';

const softTable = pgTable('test_soft', {
  id: text('id').primaryKey(),
  ...softDeleteColumns(),
});

const hardTable = pgTable('test_hard', {
  id: text('id').primaryKey(),
});

function mockConfig(overrides: Partial<EntityConfig> = {}): EntityConfig {
  return {
    entityType: 'test_entity',
    singularName: 'Test Entity',
    pluralName: 'Test Entities',
    slug: 'test-entities',
    table: softTable as any,
    systemColumns: ['id', 'deletedAt', 'deletedBy'],
    searchFields: [],
    defaultSort: 'createdAt',
    sortableFields: [],
    fieldMeta: {},
    sections: [],
    nameField: 'name',
    ...overrides,
  };
}

describe('EntityRegistryService', () => {
  let registry: EntityRegistryService;
  let featureDerivers: FeatureDeriverRegistry;

  beforeEach(() => {
    featureDerivers = new FeatureDeriverRegistry();
    registry = new EntityRegistryService(featureDerivers);
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

  describe('identity fallback', () => {
    it('derives singularName / pluralName from slug when omitted', () => {
      const config = mockConfig({
        entityType: 'job_openings',
        slug: 'job-openings',
        singularName: undefined,
        pluralName: undefined,
      });
      registry.register(config);

      const registered = registry.getOrFail('job_openings');
      expect(registered.singularName).toBe('Job opening');
      expect(registered.pluralName).toBe('Job openings');
    });

    it('preserves explicit singularName / pluralName when provided', () => {
      const config = mockConfig({
        slug: 'widgets',
        singularName: 'Widget',
        pluralName: 'Widget Inventory',
      });
      registry.register(config);

      const registered = registry.getOrFail('test_entity');
      expect(registered.singularName).toBe('Widget');
      expect(registered.pluralName).toBe('Widget Inventory');
    });

    it('handles snake_case slugs', () => {
      const config = mockConfig({
        entityType: 'audit_log',
        slug: 'audit_log',
        singularName: undefined,
        pluralName: undefined,
      });
      registry.register(config);

      const registered = registry.getOrFail('audit_log');
      expect(registered.singularName).toBe('Audit log');
      expect(registered.pluralName).toBe('Audit log');
    });
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
      table: softTable as any,
      nameField: ['firstName', 'lastName'],
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
    expect(entry.nameField).toEqual(['firstName', 'lastName']);
    expect(entry.features.softDelete).toBe(true);
    expect(entry.features.hasTaxonomy).toBe(true);
    expect(entry.relationships).toHaveLength(1);
    expect(entry.relationships[0].name).toBe('applications');
    // foreignKey IS serialized (needed for related list filtering)
    expect(entry.relationships[0].foreignKey).toBe('candidateId');
  });

  it('derives softDelete feature from schema (table has softDeleteColumns)', () => {
    registry.register(mockConfig({ table: softTable as any }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.softDelete).toBe(true);
    expect(entries[0].features.restore).toBe(true);
  });

  it('softDelete feature is false when schema lacks softDeleteColumns', () => {
    registry.register(mockConfig({ table: hardTable as any }));

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

  it('forwards opaque addon features bag verbatim', () => {
    registry.register(mockConfig({
      entityType: 'with_addons',
      slug: 'with-addons',
      features: {
        notes: { enabled: true },
        attachments: { enabled: true, maxFileSize: 5 * 1024 * 1024, deleteMode: 'hard' },
        tags: { groupSlug: 'task-tags' },
      },
    }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.notes).toEqual({ enabled: true });
    expect(entries[0].features.attachments).toEqual({
      enabled: true,
      maxFileSize: 5 * 1024 * 1024,
      deleteMode: 'hard',
    });
    expect(entries[0].features.tags).toEqual({ groupSlug: 'task-tags' });
  });

  it('addon feature keys default to undefined when bag is empty', () => {
    registry.register(mockConfig());

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.notes).toBeUndefined();
    expect(entries[0].features.attachments).toBeUndefined();
    expect(entries[0].features.tags).toBeUndefined();
  });

  it('merges feature-deriver output into the features bag', () => {
    featureDerivers.register((config) => ({ marker: { entity: config.entityType } }));
    registry.register(mockConfig({ entityType: 'derived_entity', slug: 'derived-entity' }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.marker).toEqual({ entity: 'derived_entity' });
  });

  it('config.features overrides deriver output for the same key', () => {
    featureDerivers.register(() => ({ shared: { from: 'deriver' } }));
    registry.register(mockConfig({ features: { shared: { from: 'config' } } }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.shared).toEqual({ from: 'config' });
  });

  // ---------------------------------------------------------------------------
  // searchFields / sortableFields → PgColumn resolution at finalize
  // ---------------------------------------------------------------------------

  describe('read-column resolution', () => {
    const readTable = pgTable('read_entities', {
      id: text('id').primaryKey(),
      title: text('title').notNull(),
      slug: text('slug'),
      createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    });

    function readConfig(overrides: Partial<EntityConfig> = {}): EntityConfig {
      return mockConfig({
        entityType: 'read_entities',
        slug: 'read-entities',
        table: readTable as unknown as EntityConfig['table'],
        ...overrides,
      });
    }

    it('resolves declared field keys to PgColumns', () => {
      registry.register(readConfig({
        searchFields: ['title', 'slug'],
        sortableFields: ['title', 'createdAt'],
      }));
      registry.finalize();

      const resolved = registry.getResolvedReadColumns('read_entities');
      expect(resolved.searchColumns).toHaveLength(2);
      expect(Object.keys(resolved.sortableColumns)).toEqual(
        expect.arrayContaining(['title', 'createdAt']),
      );
    });

    it('throws at finalize when searchFields names a missing column', () => {
      registry.register(readConfig({ searchFields: ['ghost'] }));

      expect(() => registry.finalize()).toThrow(
        /searchFields includes 'ghost', which is not a column on the table/,
      );
    });

    it('throws at finalize when sortableFields names a missing column', () => {
      registry.register(readConfig({ sortableFields: ['ghost'] }));

      expect(() => registry.finalize()).toThrow(
        /sortableFields includes 'ghost', which is not a column on the table/,
      );
    });

    it('always makes defaultSort sortable even if omitted from sortableFields', () => {
      registry.register(readConfig({
        defaultSort: 'createdAt',
        sortableFields: ['title'],
      }));
      registry.finalize();

      const resolved = registry.getResolvedReadColumns('read_entities');
      expect(resolved.sortableColumns.createdAt).toBeDefined();
    });

    it('throws when getResolvedReadColumns is called before finalize', () => {
      registry.register(readConfig());

      expect(() => registry.getResolvedReadColumns('read_entities')).toThrow(
        /called before finalize/,
      );
    });
  });

});
