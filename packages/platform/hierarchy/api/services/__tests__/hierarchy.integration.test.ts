import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { sql } from '@packages/database';
import { HierarchyModule } from '../../hierarchy.module';
import { HierarchyService } from '../hierarchy.service';
import { pgTable, text, integer } from 'drizzle-orm/pg-core';

/**
 * Inline Drizzle table references matching the taxonomy migration schema.
 * Defined here to avoid a devDependency on @packages/taxonomy (which depends
 * on @packages/hierarchy at runtime, creating a cycle).
 */
const categoryGroups = pgTable('category_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
});

const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  parentId: text('parent_id'),
  path: text('path').notNull().default('/'),
  depth: integer('depth').notNull().default(0),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
});
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('HierarchyService (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let hierarchyService: HierarchyService;
  let groupId: string;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      imports: [HierarchyModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    hierarchyService = module.get(HierarchyService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  /** Insert a category group and return its ID. */
  async function createGroup(): Promise<string> {
    const id = randomUUID();
    await db.insert(categoryGroups).values({
      id,
      name: 'Test Group',
      slug: `test-group-${id.slice(0, 8)}`,
    });
    return id;
  }

  /** Insert a category row directly. */
  async function insertCategory(opts: {
    groupId: string;
    parentId?: string | null;
    path?: string;
    depth?: number;
    name?: string;
  }) {
    const id = randomUUID();
    await db.insert(categories).values({
      id,
      groupId: opts.groupId,
      parentId: opts.parentId ?? null,
      path: opts.path ?? '/',
      depth: opts.depth ?? 0,
      name: opts.name ?? `Cat ${id.slice(0, 6)}`,
      slug: `cat-${id.slice(0, 8)}`,
    });
    return id;
  }

  /** Read a category row by ID. */
  async function getCategory(id: string) {
    const rows = await db
      .select()
      .from(categories)
      .where(sql`${categories.id} = ${id}`);
    return rows[0] ?? null;
  }

  // ---------- computeInsertValues ----------

  describe('computeInsertValues', () => {
    it('should compute root path and depth for null parent', () => {
      const nodeId = randomUUID();
      const result = hierarchyService.computeInsertValues(null, nodeId);
      expect(result.path).toBe(`/${nodeId}`);
      expect(result.depth).toBe(0);
    });

    it('should compute child path and depth', () => {
      const parentId = randomUUID();
      const childId = randomUUID();
      const parentPath = `/${parentId}`;
      const result = hierarchyService.computeInsertValues(parentPath, childId);
      expect(result.path).toBe(`/${parentId}/${childId}`);
      expect(result.depth).toBe(1);
    });

    it('should compute deeply nested path and depth', () => {
      const a = randomUUID();
      const b = randomUUID();
      const c = randomUUID();
      const parentPath = `/${a}/${b}`;
      const result = hierarchyService.computeInsertValues(parentPath, c);
      expect(result.path).toBe(`/${a}/${b}/${c}`);
      expect(result.depth).toBe(2);
    });
  });

  // ---------- getAncestors ----------

  describe('getAncestors', () => {
    it('should return empty array for a root node', async () => {
      const gId = await createGroup();
      const rootId = randomUUID();
      await db.insert(categories).values({
        id: rootId,
        groupId: gId,
        parentId: null,
        path: `/${rootId}`,
        depth: 0,
        name: 'Root',
        slug: `root-${rootId.slice(0, 8)}`,
      });

      const ancestors = await hierarchyService.getAncestors(
        categories, categories.id, categories.path, `/${rootId}`,
      );
      expect(ancestors).toHaveLength(0);
    });

    it('should return parent for a first-level child', async () => {
      const gId = await createGroup();
      const rootId = await insertCategory({ groupId: gId, path: `/${randomUUID()}`, depth: 0 });
      const rootCat = await getCategory(rootId);
      // Fix path to use actual ID
      await db.update(categories).set({ path: `/${rootId}`, depth: 0 }).where(sql`${categories.id} = ${rootId}`);

      const childId = await insertCategory({
        groupId: gId,
        parentId: rootId,
        path: `/${rootId}/${randomUUID()}`,
        depth: 1,
      });
      const childCat = await getCategory(childId);
      // Fix child path
      await db.update(categories).set({ path: `/${rootId}/${childId}`, depth: 1 }).where(sql`${categories.id} = ${childId}`);

      const ancestors = await hierarchyService.getAncestors(
        categories, categories.id, categories.path, `/${rootId}/${childId}`,
      );
      expect(ancestors).toHaveLength(1);
      expect(ancestors[0].id).toBe(rootId);
    });

    it('should return all ancestors ordered root-to-parent for deep nesting', async () => {
      const gId = await createGroup();
      const rootId = await insertCategory({ groupId: gId });
      await db.update(categories).set({ path: `/${rootId}`, depth: 0 }).where(sql`${categories.id} = ${rootId}`);

      const midId = await insertCategory({ groupId: gId, parentId: rootId });
      await db.update(categories).set({ path: `/${rootId}/${midId}`, depth: 1 }).where(sql`${categories.id} = ${midId}`);

      const leafId = await insertCategory({ groupId: gId, parentId: midId });
      await db.update(categories).set({ path: `/${rootId}/${midId}/${leafId}`, depth: 2 }).where(sql`${categories.id} = ${leafId}`);

      const ancestors = await hierarchyService.getAncestors(
        categories, categories.id, categories.path, `/${rootId}/${midId}/${leafId}`,
      );
      expect(ancestors).toHaveLength(2);
      expect(ancestors[0].id).toBe(rootId);
      expect(ancestors[1].id).toBe(midId);
    });
  });

  // ---------- getDescendants ----------

  describe('getDescendants', () => {
    it('should return empty array when node has no descendants', async () => {
      const gId = await createGroup();
      const rootId = await insertCategory({ groupId: gId });
      await db.update(categories).set({ path: `/${rootId}`, depth: 0 }).where(sql`${categories.id} = ${rootId}`);

      const descendants = await hierarchyService.getDescendants(
        categories, categories.path, `/${rootId}`,
      );
      expect(descendants).toHaveLength(0);
    });

    it('should return direct children', async () => {
      const gId = await createGroup();
      const rootId = await insertCategory({ groupId: gId });
      await db.update(categories).set({ path: `/${rootId}`, depth: 0 }).where(sql`${categories.id} = ${rootId}`);

      const child1 = await insertCategory({ groupId: gId, parentId: rootId });
      await db.update(categories).set({ path: `/${rootId}/${child1}`, depth: 1 }).where(sql`${categories.id} = ${child1}`);

      const child2 = await insertCategory({ groupId: gId, parentId: rootId });
      await db.update(categories).set({ path: `/${rootId}/${child2}`, depth: 1 }).where(sql`${categories.id} = ${child2}`);

      const descendants = await hierarchyService.getDescendants(
        categories, categories.path, `/${rootId}`,
      );
      expect(descendants).toHaveLength(2);
    });

    it('should return all descendants at multiple levels', async () => {
      const gId = await createGroup();
      const rootId = await insertCategory({ groupId: gId });
      await db.update(categories).set({ path: `/${rootId}`, depth: 0 }).where(sql`${categories.id} = ${rootId}`);

      const childId = await insertCategory({ groupId: gId, parentId: rootId });
      await db.update(categories).set({ path: `/${rootId}/${childId}`, depth: 1 }).where(sql`${categories.id} = ${childId}`);

      const grandchildId = await insertCategory({ groupId: gId, parentId: childId });
      await db.update(categories).set({ path: `/${rootId}/${childId}/${grandchildId}`, depth: 2 }).where(sql`${categories.id} = ${grandchildId}`);

      const descendants = await hierarchyService.getDescendants(
        categories, categories.path, `/${rootId}`,
      );
      expect(descendants).toHaveLength(2);
      const ids = descendants.map((d: any) => d.id);
      expect(ids).toContain(childId);
      expect(ids).toContain(grandchildId);
    });

    it('should not return nodes from other subtrees', async () => {
      const gId = await createGroup();
      const root1 = await insertCategory({ groupId: gId });
      await db.update(categories).set({ path: `/${root1}`, depth: 0 }).where(sql`${categories.id} = ${root1}`);

      const root2 = await insertCategory({ groupId: gId });
      await db.update(categories).set({ path: `/${root2}`, depth: 0 }).where(sql`${categories.id} = ${root2}`);

      const child1 = await insertCategory({ groupId: gId, parentId: root1 });
      await db.update(categories).set({ path: `/${root1}/${child1}`, depth: 1 }).where(sql`${categories.id} = ${child1}`);

      const child2 = await insertCategory({ groupId: gId, parentId: root2 });
      await db.update(categories).set({ path: `/${root2}/${child2}`, depth: 1 }).where(sql`${categories.id} = ${child2}`);

      const descendants = await hierarchyService.getDescendants(
        categories, categories.path, `/${root1}`,
      );
      expect(descendants).toHaveLength(1);
      expect(descendants[0].id).toBe(child1);
    });
  });

  // ---------- move ----------

  describe('move', () => {
    it('should throw ConflictException when moving a node to itself', async () => {
      const gId = await createGroup();
      const nodeId = await insertCategory({ groupId: gId });
      await db.update(categories).set({ path: `/${nodeId}`, depth: 0 }).where(sql`${categories.id} = ${nodeId}`);

      await expect(
        hierarchyService.move(
          categories, categories.id, categories.parentId, categories.path, categories.depth,
          nodeId, `/${nodeId}`, nodeId, `/${nodeId}`,
        ),
      ).rejects.toThrow('A node cannot be its own parent');
    });

    it('should throw ConflictException when move would create a cycle', async () => {
      const gId = await createGroup();
      const parentId = await insertCategory({ groupId: gId });
      await db.update(categories).set({ path: `/${parentId}`, depth: 0 }).where(sql`${categories.id} = ${parentId}`);

      const childId = await insertCategory({ groupId: gId, parentId });
      await db.update(categories).set({ path: `/${parentId}/${childId}`, depth: 1 }).where(sql`${categories.id} = ${childId}`);

      // Try to move parent under child → cycle
      await expect(
        hierarchyService.move(
          categories, categories.id, categories.parentId, categories.path, categories.depth,
          parentId, `/${parentId}`, childId, `/${parentId}/${childId}`,
        ),
      ).rejects.toThrow('Moving this node would create a cycle');
    });

    it('should move a node to root (null parent)', async () => {
      const gId = await createGroup();
      const parentId = await insertCategory({ groupId: gId });
      await db.update(categories).set({ path: `/${parentId}`, depth: 0 }).where(sql`${categories.id} = ${parentId}`);

      const childId = await insertCategory({ groupId: gId, parentId });
      await db.update(categories).set({ path: `/${parentId}/${childId}`, depth: 1 }).where(sql`${categories.id} = ${childId}`);

      await hierarchyService.move(
        categories, categories.id, categories.parentId, categories.path, categories.depth,
        childId, `/${parentId}/${childId}`, null, null,
      );

      const moved = await getCategory(childId);
      expect(moved.parentId).toBeNull();
      expect(moved.path).toBe(`/${childId}`);
      expect(moved.depth).toBe(0);
    });

    it('should move a node to a different parent', async () => {
      const gId = await createGroup();
      const parent1 = await insertCategory({ groupId: gId, name: 'Parent 1' });
      await db.update(categories).set({ path: `/${parent1}`, depth: 0 }).where(sql`${categories.id} = ${parent1}`);

      const parent2 = await insertCategory({ groupId: gId, name: 'Parent 2' });
      await db.update(categories).set({ path: `/${parent2}`, depth: 0 }).where(sql`${categories.id} = ${parent2}`);

      const childId = await insertCategory({ groupId: gId, parentId: parent1, name: 'Child' });
      await db.update(categories).set({ path: `/${parent1}/${childId}`, depth: 1 }).where(sql`${categories.id} = ${childId}`);

      await hierarchyService.move(
        categories, categories.id, categories.parentId, categories.path, categories.depth,
        childId, `/${parent1}/${childId}`, parent2, `/${parent2}`,
      );

      const moved = await getCategory(childId);
      expect(moved.parentId).toBe(parent2);
      expect(moved.path).toBe(`/${parent2}/${childId}`);
      expect(moved.depth).toBe(1);
    });

    it('should rebase descendant paths when moving a subtree', async () => {
      const gId = await createGroup();
      const root = await insertCategory({ groupId: gId, name: 'Root' });
      await db.update(categories).set({ path: `/${root}`, depth: 0 }).where(sql`${categories.id} = ${root}`);

      const parent = await insertCategory({ groupId: gId, parentId: root, name: 'Parent' });
      await db.update(categories).set({ path: `/${root}/${parent}`, depth: 1 }).where(sql`${categories.id} = ${parent}`);

      const child = await insertCategory({ groupId: gId, parentId: parent, name: 'Child' });
      await db.update(categories).set({ path: `/${root}/${parent}/${child}`, depth: 2 }).where(sql`${categories.id} = ${child}`);

      const grandchild = await insertCategory({ groupId: gId, parentId: child, name: 'Grandchild' });
      await db.update(categories).set({ path: `/${root}/${parent}/${child}/${grandchild}`, depth: 3 }).where(sql`${categories.id} = ${grandchild}`);

      // Move 'parent' subtree to root
      await hierarchyService.move(
        categories, categories.id, categories.parentId, categories.path, categories.depth,
        parent, `/${root}/${parent}`, null, null,
      );

      const movedParent = await getCategory(parent);
      expect(movedParent.path).toBe(`/${parent}`);
      expect(movedParent.depth).toBe(0);

      const movedChild = await getCategory(child);
      expect(movedChild.path).toBe(`/${parent}/${child}`);
      expect(movedChild.depth).toBe(1);

      const movedGrandchild = await getCategory(grandchild);
      expect(movedGrandchild.path).toBe(`/${parent}/${child}/${grandchild}`);
      expect(movedGrandchild.depth).toBe(2);
    });
  });

  // ---------- backfillPaths ----------

  describe('backfillPaths', () => {
    it('should return 0 for an empty table', async () => {
      const count = await hierarchyService.backfillPaths(
        categories, categories.id, categories.parentId, categories.path, categories.depth,
      );
      expect(count).toBe(0);
    });

    it('should backfill path for a single root node', async () => {
      const gId = await createGroup();
      const nodeId = await insertCategory({ groupId: gId, path: '/', depth: 0 });

      const count = await hierarchyService.backfillPaths(
        categories, categories.id, categories.parentId, categories.path, categories.depth,
      );
      expect(count).toBe(1);

      const node = await getCategory(nodeId);
      expect(node.path).toBe(`/${nodeId}`);
      expect(node.depth).toBe(0);
    });

    it('should backfill paths for a parent-child hierarchy', async () => {
      const gId = await createGroup();
      const parentId = await insertCategory({ groupId: gId, path: '/', depth: 0 });
      const childId = await insertCategory({ groupId: gId, parentId, path: '/', depth: 0 });

      const count = await hierarchyService.backfillPaths(
        categories, categories.id, categories.parentId, categories.path, categories.depth,
      );
      expect(count).toBe(2);

      const parent = await getCategory(parentId);
      expect(parent.path).toBe(`/${parentId}`);
      expect(parent.depth).toBe(0);

      const child = await getCategory(childId);
      expect(child.path).toBe(`/${parentId}/${childId}`);
      expect(child.depth).toBe(1);
    });

    it('should backfill paths for a deep tree', async () => {
      const gId = await createGroup();
      const a = await insertCategory({ groupId: gId, path: '/', depth: 0 });
      const b = await insertCategory({ groupId: gId, parentId: a, path: '/', depth: 0 });
      const c = await insertCategory({ groupId: gId, parentId: b, path: '/', depth: 0 });
      const d = await insertCategory({ groupId: gId, parentId: c, path: '/', depth: 0 });

      const count = await hierarchyService.backfillPaths(
        categories, categories.id, categories.parentId, categories.path, categories.depth,
      );
      expect(count).toBe(4);

      const nodeA = await getCategory(a);
      expect(nodeA.path).toBe(`/${a}`);
      expect(nodeA.depth).toBe(0);

      const nodeB = await getCategory(b);
      expect(nodeB.path).toBe(`/${a}/${b}`);
      expect(nodeB.depth).toBe(1);

      const nodeC = await getCategory(c);
      expect(nodeC.path).toBe(`/${a}/${b}/${c}`);
      expect(nodeC.depth).toBe(2);

      const nodeD = await getCategory(d);
      expect(nodeD.path).toBe(`/${a}/${b}/${c}/${d}`);
      expect(nodeD.depth).toBe(3);
    });

    it('should backfill paths for multiple independent roots', async () => {
      const gId = await createGroup();
      const root1 = await insertCategory({ groupId: gId, path: '/', depth: 0 });
      const root2 = await insertCategory({ groupId: gId, path: '/', depth: 0 });
      const child1 = await insertCategory({ groupId: gId, parentId: root1, path: '/', depth: 0 });

      const count = await hierarchyService.backfillPaths(
        categories, categories.id, categories.parentId, categories.path, categories.depth,
      );
      expect(count).toBe(3);

      const r1 = await getCategory(root1);
      expect(r1.path).toBe(`/${root1}`);

      const r2 = await getCategory(root2);
      expect(r2.path).toBe(`/${root2}`);

      const c1 = await getCategory(child1);
      expect(c1.path).toBe(`/${root1}/${child1}`);
      expect(c1.depth).toBe(1);
    });
  });
});
