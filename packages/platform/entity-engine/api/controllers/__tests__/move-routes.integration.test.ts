import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, type PackageTestApp } from '@packages/platform-testing';
import { hierarchyColumns, HierarchyModule } from '@packages/hierarchy';
import { orderableColumns, OrderableModule } from '@packages/orderable';
import { DatabaseService } from '@packages/database';
import { EntityEngineModule } from '../../entity-engine.module';
import { EntityEngineSeedService } from '../../services/entity-engine-seed.service';
import { EntityService } from '../../entity.service';
import { defineEntity } from '../../define-entity';

// ---------------------------------------------------------------------------
// Test tables cover the two `move()` flag combinations whose behaviour
// branches inside EntityService:
//   - orderable only        (navItems)       — sort-order updates, no parent
//   - hierarchy + orderable (menuItems)      — combined reparent + reorder
//
// HTTP-level wiring for the /move route is covered by every fanned-out
// hierarchical/orderable entity controller (e.g. MenuItemsController in the
// menus addon); this test exercises the engine mechanics via EntityService
// directly.
// ---------------------------------------------------------------------------

const navItems = pgTable('move_test_nav_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ...orderableColumns(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: uuid('deleted_by'),
});

const menuItems = pgTable('move_test_menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ...hierarchyColumns(),
  ...orderableColumns(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  deletedBy: uuid('deleted_by'),
});

const navConfig = defineEntity({
  table: navItems,
  onDelete: { mode: 'soft' },
  slug: 'move-test-nav-items',
  singularName: 'Nav Item',
  pluralName: 'Nav Items',
  orderable: true,
  fields: {
    name: { type: 'text', label: 'Name', required: true, isLabel: true },
  },
  ui: { icon: 'List' },
});

const menuConfig = defineEntity({
  table: menuItems,
  onDelete: { mode: 'soft' },
  slug: 'move-test-menu-items',
  singularName: 'Menu Item',
  pluralName: 'Menu Items',
  hierarchy: true,
  orderable: true,
  fields: {
    name: { type: 'text', label: 'Name', required: true, isLabel: true },
  },
  ui: { icon: 'Menu' },
});

const ACTOR_ID = '00000000-0000-0000-0000-00000000b001';

describe('Move operations (integration)', () => {
  let ctx: PackageTestApp;
  let navService: EntityService;
  let menuService: EntityService;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [
        HierarchyModule,
        OrderableModule,
        EntityEngineModule,
        EntityEngineModule.forEntity(navConfig),
        EntityEngineModule.forEntity(menuConfig),
      ],
    });

    await ctx.module.get(EntityEngineSeedService).seedAll();

    const db = ctx.module.get(DatabaseService).db;
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS move_test_nav_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS move_test_menu_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        parent_id TEXT,
        path TEXT NOT NULL DEFAULT '/',
        depth INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        deleted_by UUID
      )
    `);

    navService = ctx.module.get<EntityService>('ENTITY_SERVICE_move-test-nav-items');
    menuService = ctx.module.get<EntityService>('ENTITY_SERVICE_move-test-menu-items');
  });

  beforeEach(async () => {
    const db = ctx.module.get(DatabaseService).db;
    await db.execute(sql`DELETE FROM move_test_nav_items`);
    await db.execute(sql`DELETE FROM move_test_menu_items`);
  });

  afterAll(async () => {
    const db = ctx.module.get(DatabaseService).db;
    await db.execute(sql`DROP TABLE IF EXISTS move_test_nav_items`);
    await db.execute(sql`DROP TABLE IF EXISTS move_test_menu_items`);
    await ctx.cleanup();
  });

  async function createNav(name: string): Promise<string> {
    const row = await navService.create({ name }, ACTOR_ID);
    return row.id as string;
  }

  async function createMenu(name: string, parentId: string | null = null): Promise<string> {
    const payload: Record<string, unknown> = { name };
    if (parentId) payload.parentId = parentId;
    const row = await menuService.create(payload, ACTOR_ID);
    return row.id as string;
  }

  describe('Reorder only (orderable entity)', () => {
    it('updates sort_order to an absolute value', async () => {
      const id = await createNav('First');
      const updated = await navService.move(id, { sortOrder: 2048 }, ACTOR_ID);
      expect(updated.sortOrder).toBe(2048);
    });

    it('rejects parentId on a non-hierarchical entity', async () => {
      const id = await createNav('First');
      await expect(navService.move(id, { parentId: null }, ACTOR_ID)).rejects.toThrow();
    });

    it('rejects empty body', async () => {
      const id = await createNav('First');
      await expect(navService.move(id, {}, ACTOR_ID)).rejects.toThrow();
    });
  });

  describe('Reparent + reorder (hierarchical orderable entity)', () => {
    it('reparents and reorders in a single call', async () => {
      const rootA = await createMenu('Root A');
      const rootB = await createMenu('Root B');
      const child = await createMenu('Child', rootA);

      const updated = await menuService.move(child, { parentId: rootB, sortOrder: 512 }, ACTOR_ID);

      expect(updated.parentId).toBe(rootB);
      expect(updated.depth).toBe(1);
      expect(updated.sortOrder).toBe(512);
    });

    it('reorders within the same parent when only sortOrder is passed', async () => {
      const root = await createMenu('Root');
      const a = await createMenu('A', root);

      const updated = await menuService.move(a, { sortOrder: 100 }, ACTOR_ID);

      expect(updated.parentId).toBe(root);
      expect(updated.sortOrder).toBe(100);
    });
  });
});
