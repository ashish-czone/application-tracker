import { describe, it, expect } from 'vitest';
import { hydrateEntities } from '../helpers/hydrate';
import { buildEntityUIIndex } from '../helpers/buildEntityUIIndex';
import type { EntityRegistryEntry, EntityUIConfig } from '../types';

function mk(
  entityType: string,
  ui: Partial<EntityRegistryEntry['ui']> = {},
  nameField: string | string[] = 'name',
): EntityRegistryEntry {
  return {
    entityType,
    singularName: entityType,
    pluralName: `${entityType}s`,
    slug: entityType,
    nameField,
    ui: { icon: 'Database', ...ui },
    features: { softDelete: false, restore: false, adminConfigurable: false, hasTaxonomy: false, hasMedia: false },
  } as EntityRegistryEntry;
}

describe('hydrateEntities', () => {
  it('returns the original array when no UIConfig is registered', () => {
    const entities = [mk('candidates'), mk('jobs')];
    const idx = buildEntityUIIndex([]);
    expect(hydrateEntities(entities, idx)).toBe(entities);
  });

  it('overrides backend ui fields with frontend presentation', () => {
    const entities = [mk('candidates', { icon: 'OldIcon', navGroup: 'old' })];
    const configs: EntityUIConfig[] = [
      { entityType: 'candidates', presentation: { icon: 'NewIcon', navGroup: 'recruit', navOrder: 1 } },
    ];
    const result = hydrateEntities(entities, buildEntityUIIndex(configs));
    expect(result[0].ui.icon).toBe('NewIcon');
    expect(result[0].ui.navGroup).toBe('recruit');
    expect(result[0].ui.navOrder).toBe(1);
  });

  it('preserves top-level nameField alongside hydrated presentation', () => {
    const entities = [mk('candidates', {}, 'fullName')];
    const configs: EntityUIConfig[] = [
      { entityType: 'candidates', presentation: { icon: 'NewIcon' } },
    ];
    const result = hydrateEntities(entities, buildEntityUIIndex(configs));
    expect(result[0].nameField).toBe('fullName');
    expect(result[0].ui.icon).toBe('NewIcon');
  });

  it('leaves entities without a registered UIConfig unchanged', () => {
    const entities = [mk('candidates'), mk('jobs')];
    const configs: EntityUIConfig[] = [
      { entityType: 'candidates', presentation: { icon: 'C' } },
    ];
    const result = hydrateEntities(entities, buildEntityUIIndex(configs));
    expect(result[0].ui.icon).toBe('C');
    expect(result[1]).toBe(entities[1]); // same reference, untouched
  });

  it('does not mutate the input entities', () => {
    const entities = [mk('candidates', { icon: 'OldIcon' })];
    const configs: EntityUIConfig[] = [
      { entityType: 'candidates', presentation: { icon: 'NewIcon' } },
    ];
    hydrateEntities(entities, buildEntityUIIndex(configs));
    expect(entities[0].ui.icon).toBe('OldIcon');
  });

  it('overrides singularName/pluralName/subtitleField from FE presentation', () => {
    const entities = [mk('candidates')];
    entities[0].subtitleField = 'apiSubtitle';
    const configs: EntityUIConfig[] = [
      {
        entityType: 'candidates',
        presentation: {
          singularName: 'Talent',
          pluralName: 'Talent Pool',
          subtitleField: 'currentJobTitle',
          icon: 'X',
        },
      },
    ];
    const result = hydrateEntities(entities, buildEntityUIIndex(configs));
    expect(result[0].singularName).toBe('Talent');
    expect(result[0].pluralName).toBe('Talent Pool');
    expect(result[0].subtitleField).toBe('currentJobTitle');
    expect(result[0].ui.icon).toBe('X');
    // Name fields shouldn't appear in the ui block — they live at the entry root.
    expect((result[0].ui as Record<string, unknown>).singularName).toBeUndefined();
    expect((result[0].ui as Record<string, unknown>).pluralName).toBeUndefined();
    expect((result[0].ui as Record<string, unknown>).subtitleField).toBeUndefined();
  });

  it('falls back to the api-shipped singularName/pluralName/subtitleField when FE omits them', () => {
    const entities = [mk('candidates')];
    entities[0].subtitleField = 'apiSubtitle';
    const configs: EntityUIConfig[] = [
      { entityType: 'candidates', presentation: { icon: 'X' } },
    ];
    const result = hydrateEntities(entities, buildEntityUIIndex(configs));
    expect(result[0].singularName).toBe('candidates');
    expect(result[0].pluralName).toBe('candidatess');
    expect(result[0].subtitleField).toBe('apiSubtitle');
  });
});
