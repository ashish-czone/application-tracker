import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, type PackageTestApp } from '@packages/platform-testing';
import { hierarchyColumns, HierarchyModule } from '@packages/hierarchy';
import { DatabaseService } from '@packages/database';
import { EntityEngineModule } from '../../entity-engine.module';
import { EntityEngineSeedService } from '../../services/entity-engine-seed.service';
import { EntityService } from '../../entity.service';
import { defineEntity } from '../../define-entity';

// ---------------------------------------------------------------------------
// Test table — hierarchical entity used to verify the engine's hierarchy
// operations (ancestors, descendants, reparent, cycle detection) at the
// service layer. HTTP-level coverage for the same behaviour lives on every
// fanned-out entity controller (e.g. MenuItemsController); this test covers
// the engine mechanics directly via EntityService so it stays independent of
// any domain's HTTP surface.
// ---------------------------------------------------------------------------

const folders = pgTable('hierarchy_test_folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ...hierarchyColumns(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: uuid('deleted_by'),
});

const folderConfig = defineEntity({
  table: folders,
  onDelete: { mode: 'soft' },
  slug: 'hierarchy-test-folders',
  singularName: 'Folder',
  pluralName: 'Folders',
  hierarchy: true,
  fields: {
    name: { type: 'text', label: 'Name', required: true, isLabel: true },
  },
  ui: { icon: 'Folder' },
});

const ACTOR_ID = '00000000-0000-0000-0000-00000000a001';

describe('Hierarchy operations (integration)', () => {
  let ctx: PackageTestApp;
  let entityService: EntityService;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [
        HierarchyModule,
        EntityEngineModule,
        EntityEngineModule.forEntity(folderConfig),
      ],
    });

    await ctx.module.get(EntityEngineSeedService).seedAll();

    const db = ctx.module.get(DatabaseService).db;
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS hierarchy_test_folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        parent_id TEXT,
        path TEXT NOT NULL DEFAULT '/',
        depth INTEGER NOT NULL DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      )
    `);

    entityService = ctx.module.get<EntityService>('ENTITY_SERVICE_hierarchy-test-folders');
  });

  beforeEach(async () => {
    const db = ctx.module.get(DatabaseService).db;
    await db.execute(sql`DELETE FROM hierarchy_test_folders`);
  });

  afterAll(async () => {
    const db = ctx.module.get(DatabaseService).db;
    await db.execute(sql`DROP TABLE IF EXISTS hierarchy_test_folders`);
    await ctx.cleanup();
  });

  async function createFolder(name: string, parentId: string | null = null): Promise<string> {
    const payload: Record<string, unknown> = { name };
    if (parentId) payload.parentId = parentId;
    const row = await entityService.create(payload, ACTOR_ID);
    return row.id as string;
  }

  it('returns the ancestor chain from root to parent', async () => {
    const rootId = await createFolder('Root');
    const childId = await createFolder('Child', rootId);
    const grandchildId = await createFolder('Grandchild', childId);

    const ancestors = await entityService.getAncestors(grandchildId);

    expect(ancestors).toHaveLength(2);
    const names = ancestors.map((r: any) => r.name);
    expect(names).toContain('Root');
    expect(names).toContain('Child');
  });

  it('returns all descendants beneath a node', async () => {
    const rootId = await createFolder('Root');
    await createFolder('Child A', rootId);
    const childBId = await createFolder('Child B', rootId);
    await createFolder('Grandchild', childBId);

    const descendants = await entityService.getDescendants(rootId);

    expect(descendants).toHaveLength(3);
    const names = descendants.map((r: any) => r.name).sort();
    expect(names).toEqual(['Child A', 'Child B', 'Grandchild']);
  });

  it('reparents a node and updates its depth', async () => {
    const rootAId = await createFolder('Root A');
    const rootBId = await createFolder('Root B');
    const childId = await createFolder('Child', rootAId);

    const updated = await entityService.reparent(childId, rootBId, ACTOR_ID);

    expect(updated.parentId).toBe(rootBId);
    expect(updated.depth).toBe(1);

    const ancestors = await entityService.getAncestors(childId);
    expect(ancestors).toHaveLength(1);
    expect((ancestors[0] as any).name).toBe('Root B');
  });

  it('rejects a reparent that would create a cycle', async () => {
    const rootId = await createFolder('Root');
    const childId = await createFolder('Child', rootId);

    await expect(entityService.reparent(rootId, childId, ACTOR_ID)).rejects.toThrow();
  });
});
