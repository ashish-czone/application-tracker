import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createPackageTestApp, withAuth, type PackageTestApp } from '@packages/platform-testing';
import { hierarchyColumns, HierarchyModule } from '@packages/hierarchy';
import { DatabaseService } from '@packages/database';
import { EntityEngineModule } from '../../entity-engine.module';
import { EntityEngineSeedService } from '../../services/entity-engine-seed.service';
import { defineEntity } from '../../define-entity';

// ---------------------------------------------------------------------------
// Test table — hierarchical entity used to verify the generated routes
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
  slug: 'hierarchy-test-folders',
  singularName: 'Folder',
  pluralName: 'Folders',
  hierarchy: true,
  fields: {
    name: { type: 'text', label: 'Name', required: true, isLabel: true },
  },
  ui: { icon: 'Folder' },
});

const READ = ['hierarchy-test-folders.read'];
const UPDATE = ['hierarchy-test-folders.read', 'hierarchy-test-folders.update'];

describe('Hierarchy routes (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [
        HierarchyModule,
        EntityEngineModule,
        EntityEngineModule.forEntity(folderConfig),
      ],
    });

    // Seed field definitions for the registered entity (previously done by
    // EntityEngineModule.onApplicationBootstrap, now CLI-driven).
    await ctx.module.get(EntityEngineSeedService).seedAll();

    // Create the test table
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
    const body: Record<string, unknown> = { name };
    if (parentId) body.parentId = parentId;
    const res = await request(ctx.httpServer)
      .post('/api/v1/hierarchy-test-folders')
      .set(withAuth(['hierarchy-test-folders.create']))
      .send(body)
      .expect(201);
    return res.body.id;
  }

  // ── Auth ────────────────────────────────────────────────────

  describe('401 without auth', () => {
    it('rejects POST :id/reparent', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/hierarchy-test-folders/00000000-0000-0000-0000-000000000000/reparent')
        .send({ parentId: null })
        .expect(401);
    });

    it('rejects GET :id/ancestors', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/hierarchy-test-folders/00000000-0000-0000-0000-000000000000/ancestors')
        .expect(401);
    });

    it('rejects GET :id/descendants', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/hierarchy-test-folders/00000000-0000-0000-0000-000000000000/descendants')
        .expect(401);
    });
  });

  describe('403 with wrong permission', () => {
    it('rejects POST :id/reparent with read-only permission', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/hierarchy-test-folders/00000000-0000-0000-0000-000000000000/reparent')
        .set(withAuth(READ))
        .send({ parentId: null })
        .expect(403);
    });

    it('rejects GET :id/ancestors without the read permission', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/hierarchy-test-folders/00000000-0000-0000-0000-000000000000/ancestors')
        .set(withAuth(['other.read']))
        .expect(403);
    });

    it('rejects GET :id/descendants without the read permission', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/hierarchy-test-folders/00000000-0000-0000-0000-000000000000/descendants')
        .set(withAuth(['other.read']))
        .expect(403);
    });
  });

  // ── Happy path ────────────────────────────────────────────────────

  describe('Hierarchy operations', () => {
    it('returns the ancestor chain from root to parent', async () => {
      const rootId = await createFolder('Root');
      const childId = await createFolder('Child', rootId);
      const grandchildId = await createFolder('Grandchild', childId);

      const res = await request(ctx.httpServer)
        .get(`/api/v1/hierarchy-test-folders/${grandchildId}/ancestors`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(2);
      const names = res.body.map((r: any) => r.name);
      expect(names).toContain('Root');
      expect(names).toContain('Child');
    });

    it('returns all descendants beneath a node', async () => {
      const rootId = await createFolder('Root');
      await createFolder('Child A', rootId);
      const childBId = await createFolder('Child B', rootId);
      await createFolder('Grandchild', childBId);

      const res = await request(ctx.httpServer)
        .get(`/api/v1/hierarchy-test-folders/${rootId}/descendants`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(3);
      const names = res.body.map((r: any) => r.name).sort();
      expect(names).toEqual(['Child A', 'Child B', 'Grandchild']);
    });

    it('reparents a node and updates its depth', async () => {
      const rootAId = await createFolder('Root A');
      const rootBId = await createFolder('Root B');
      const childId = await createFolder('Child', rootAId);

      const res = await request(ctx.httpServer)
        .post(`/api/v1/hierarchy-test-folders/${childId}/reparent`)
        .set(withAuth(UPDATE))
        .send({ parentId: rootBId })
        .expect(201);

      expect(res.body.parentId).toBe(rootBId);
      expect(res.body.depth).toBe(1);

      // Ancestors should now include Root B, not Root A
      const ancestors = await request(ctx.httpServer)
        .get(`/api/v1/hierarchy-test-folders/${childId}/ancestors`)
        .set(withAuth(READ))
        .expect(200);
      expect(ancestors.body).toHaveLength(1);
      expect(ancestors.body[0].name).toBe('Root B');
    });

    it('rejects a reparent that would create a cycle', async () => {
      const rootId = await createFolder('Root');
      const childId = await createFolder('Child', rootId);

      await request(ctx.httpServer)
        .post(`/api/v1/hierarchy-test-folders/${rootId}/reparent`)
        .set(withAuth(UPDATE))
        .send({ parentId: childId })
        .expect(409);
    });
  });
});
