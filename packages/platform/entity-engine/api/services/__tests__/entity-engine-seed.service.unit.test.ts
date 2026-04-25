import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { EntityEngineSeedService } from '../entity-engine-seed.service';
import { EntityRegistryService } from '../../entity-registry.service';
import { FeatureDeriverRegistry } from '../feature-deriver.registry';
import { defineEntity } from '../../define-entity';

// `seedEntityFields` and `seedWorkflows` hit a live DB via the injected services;
// we mock the module so the unit test only asserts the skip/run decision.
vi.mock('../../seed-entity-fields', () => ({
  seedEntityFields: vi.fn().mockResolvedValue(undefined),
  seedWorkflows: vi.fn().mockResolvedValue(undefined),
}));

import { seedEntityFields, seedWorkflows } from '../../seed-entity-fields';

const tbl = pgTable('things', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

describe('EntityEngineSeedService', () => {
  let registry: EntityRegistryService;
  let service: EntityEngineSeedService;
  const fieldDefService = {} as never;
  const layoutExt = { seedDefaultLayout: vi.fn() } as never;
  const workflowExt = { getBySlug: vi.fn(), createDefinition: vi.fn(), createState: vi.fn(), createTransition: vi.fn() } as never;

  beforeEach(() => {
    vi.mocked(seedEntityFields).mockClear();
    vi.mocked(seedWorkflows).mockClear();
    registry = new EntityRegistryService(new FeatureDeriverRegistry());
    service = new EntityEngineSeedService(registry, fieldDefService, layoutExt, workflowExt);
  });

  it('skips seeding when the entity is not admin-configurable', async () => {
    const config = defineEntity({
      table: tbl,
      slug: 'things',
      fields: { name: { type: 'text', label: 'Name' } },
      ui: { icon: 'Box' },
    });

    await service.seedEntity(config);

    expect(seedEntityFields).not.toHaveBeenCalled();
    expect(seedWorkflows).not.toHaveBeenCalled();
  });

  it('seeds when the entity opts in via adminConfigurable', async () => {
    const config = defineEntity({
      table: tbl,
      slug: 'things',
      adminConfigurable: true,
      fields: { name: { type: 'text', label: 'Name' } },
      ui: { icon: 'Box' },
    });

    await service.seedEntity(config);

    expect(seedEntityFields).toHaveBeenCalledTimes(1);
    expect(seedWorkflows).toHaveBeenCalledTimes(1);
  });

  it('seedAll honours the per-entity flag', async () => {
    registry.register(defineEntity({
      table: tbl,
      slug: 'skipped',
      fields: { name: { type: 'text', label: 'Name' } },
      ui: { icon: 'Box' },
    }));
    registry.register(defineEntity({
      table: pgTable('admined', { id: text('id').primaryKey(), name: text('name').notNull() }),
      slug: 'admined',
      adminConfigurable: true,
      fields: { name: { type: 'text', label: 'Name' } },
      ui: { icon: 'Box' },
    }));

    await service.seedAll();

    expect(seedEntityFields).toHaveBeenCalledTimes(1);
    const [configArg] = vi.mocked(seedEntityFields).mock.calls[0];
    expect(configArg.entityType).toBe('admined');
  });
});
