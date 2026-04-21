import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, type PackageTestApp } from '@packages/platform-testing';
import { hierarchyColumns, HierarchyModule } from '@packages/hierarchy';
import { orderableColumns, OrderableModule } from '@packages/orderable';
import { DatabaseService } from '@packages/database';
import { EntityEngineModule } from '../../entity-engine.module';
import { EntityEngineSeedService } from '../../services/entity-engine-seed.service';
import { defineEntity } from '../../define-entity';

// ---------------------------------------------------------------------------
// Test tables — three shapes covering the flag combinations:
//   - orderable only       (navItems)
//   - hierarchy + orderable (menuItems)
//   - neither              (folders from hierarchy-routes already covers this
//                           side; omitted here)
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

const NAV_UPDATE = ['move-test-nav-items.read', 'move-test-nav-items.update'];
const MENU_UPDATE = ['move-test-menu-items.read', 'move-test-menu-items.update'];

describe('Move routes (integration)', () => {
  let ctx: PackageTestApp;

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
    const res = await request(ctx.httpServer)
      .post('/api/v1/move-test-nav-items')
      .set(withAuth(['move-test-nav-items.create']))
      .send({ name })
      .expect(201);
    return res.body.id;
  }

  async function createMenu(name: string, parentId: string | null = null): Promise<string> {
    const body: Record<string, unknown> = { name };
    if (parentId) body.parentId = parentId;
    const res = await request(ctx.httpServer)
      .post('/api/v1/move-test-menu-items')
      .set(withAuth(['move-test-menu-items.create']))
      .send(body)
      .expect(201);
    return res.body.id;
  }

  // ── Auth ────────────────────────────────────────────────────

  describe('401 without auth', () => {
    it('rejects POST :id/move', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/move-test-nav-items/00000000-0000-0000-0000-000000000000/move')
        .send({ sortOrder: 1 })
        .expect(401);
    });
  });

  describe('403 with wrong permission', () => {
    it('rejects POST :id/move with read-only permission', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/move-test-nav-items/00000000-0000-0000-0000-000000000000/move')
        .set(withAuth(['move-test-nav-items.read']))
        .send({ sortOrder: 1 })
        .expect(403);
    });
  });

  // ── Reorder-only on an orderable-only entity ────────────────

  describe('Reorder only (orderable entity)', () => {
    it('updates sort_order to an absolute value', async () => {
      const id = await createNav('First');

      const res = await request(ctx.httpServer)
        .post(`/api/v1/move-test-nav-items/${id}/move`)
        .set(withAuth(NAV_UPDATE))
        .send({ sortOrder: 2048 })
        .expect(201);

      expect(res.body.sortOrder).toBe(2048);
    });

    it('rejects parentId on a non-hierarchical entity', async () => {
      const id = await createNav('First');

      await request(ctx.httpServer)
        .post(`/api/v1/move-test-nav-items/${id}/move`)
        .set(withAuth(NAV_UPDATE))
        .send({ parentId: null })
        .expect(400);
    });

    it('rejects empty body', async () => {
      const id = await createNav('First');

      await request(ctx.httpServer)
        .post(`/api/v1/move-test-nav-items/${id}/move`)
        .set(withAuth(NAV_UPDATE))
        .send({})
        .expect(400);
    });
  });

  // ── Combined reparent + reorder (hierarchy + orderable) ─────

  describe('Reparent + reorder (hierarchical orderable entity)', () => {
    it('reparents and reorders in a single call', async () => {
      const rootA = await createMenu('Root A');
      const rootB = await createMenu('Root B');
      const child = await createMenu('Child', rootA);

      const res = await request(ctx.httpServer)
        .post(`/api/v1/move-test-menu-items/${child}/move`)
        .set(withAuth(MENU_UPDATE))
        .send({ parentId: rootB, sortOrder: 512 })
        .expect(201);

      expect(res.body.parentId).toBe(rootB);
      expect(res.body.depth).toBe(1);
      expect(res.body.sortOrder).toBe(512);
    });

    it('reorders within the same parent when only sortOrder is passed', async () => {
      const root = await createMenu('Root');
      const a = await createMenu('A', root);

      const res = await request(ctx.httpServer)
        .post(`/api/v1/move-test-menu-items/${a}/move`)
        .set(withAuth(MENU_UPDATE))
        .send({ sortOrder: 100 })
        .expect(201);

      expect(res.body.parentId).toBe(root);
      expect(res.body.sortOrder).toBe(100);
    });
  });
});
