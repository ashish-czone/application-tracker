import { describe, it, expect, beforeEach } from 'vitest';
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

  it('derives softDelete from table schema', () => {
    registry.register(mockConfig({ table: { deletedAt: {} } as any }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.softDelete).toBe(true);
    expect(entries[0].features.restore).toBe(true);
  });

  it('softDelete is false when table has no deletedAt column', () => {
    registry.register(mockConfig({ table: {} as any }));

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
});
