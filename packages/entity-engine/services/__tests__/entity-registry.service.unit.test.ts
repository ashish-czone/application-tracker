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
    systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy'],
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
      ui: { icon: 'users', nameField: ['firstName', 'lastName'] },
      features: {
        softDelete: true,
        taxonomy: { tagGroupSlug: 'candidate-skills', label: 'Skills' },
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
    // Ensure internal fields are NOT serialized
    expect((entry.relationships[0] as any).foreignKey).toBeUndefined();
  });

  it('defaults softDelete and restore to true', () => {
    registry.register(mockConfig({ features: undefined }));

    const entries = registry.getRegistryEntries();
    expect(entries[0].features.softDelete).toBe(true);
    expect(entries[0].features.restore).toBe(true);
  });
});
