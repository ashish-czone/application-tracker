import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { HierarchyModule } from '@packages/hierarchy';
import { TaxonomyModule } from '../../taxonomy.module';
import { TAXONOMY_PERMISSIONS } from '../../permissions';

const READ = [TAXONOMY_PERMISSIONS.CATEGORIES_READ];
const MANAGE = [...READ, TAXONOMY_PERMISSIONS.CATEGORIES_MANAGE];

describe('CategoriesController (integration)', () => {
  let ctx: PackageTestApp;

  beforeAll(async () => {
    ctx = await createPackageTestApp({
      imports: [HierarchyModule, TaxonomyModule],
    });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.db);
  });

  // ── Helpers ──────────────────────────────────────────────────

  let seq = 0;

  async function createCategoryGroup(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: 'Departments',
      slug: `departments-${Date.now()}-${seq}`,
      description: 'Company departments',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/category-groups')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  async function createCategory(
    groupId: string,
    overrides: Record<string, unknown> = {},
  ) {
    seq++;
    const body = {
      name: 'Engineering',
      slug: `engineering-${Date.now()}-${seq}`,
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post(`/api/v1/category-groups/${groupId}/categories`)
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── Category Groups: CRUD ───────────────────────────────────

  describe('POST /api/v1/category-groups', () => {
    it('should create a category group', async () => {
      const group = await createCategoryGroup({ name: 'Regions', slug: 'regions' });

      expect(group).toMatchObject({
        id: expect.any(String),
        name: 'Regions',
        slug: 'regions',
      });
    });

    it('should reject missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/category-groups')
        .set(withAuth(MANAGE))
        .send({ slug: 'valid-slug' })
        .expect(400);
    });

    it('should reject missing slug', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/category-groups')
        .set(withAuth(MANAGE))
        .send({ name: 'Valid Name' })
        .expect(400);
    });

    it('should reject invalid slug format', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/category-groups')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', slug: 'Invalid Slug' })
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/category-groups')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', slug: 'test', hackField: 'injected' })
        .expect(400);
    });
  });

  describe('GET /api/v1/category-groups', () => {
    it('should list category groups', async () => {
      await createCategoryGroup({ name: 'Alpha', slug: 'alpha' });
      await createCategoryGroup({ name: 'Beta', slug: 'beta' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/category-groups')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('should return empty array when no groups exist', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/category-groups')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/v1/category-groups/:id', () => {
    it('should return a category group by ID', async () => {
      const group = await createCategoryGroup({ name: 'Locations', slug: 'locations' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/category-groups/${group.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: group.id, name: 'Locations' });
    });

    it('should return 404 for non-existent ID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/category-groups/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/category-groups/not-a-uuid')
        .set(withAuth(READ))
        .expect(400);
    });
  });

  describe('PATCH /api/v1/category-groups/:id', () => {
    it('should update a category group', async () => {
      const group = await createCategoryGroup({ name: 'Old Name', slug: 'old-name' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/category-groups/${group.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
    });

    it('should reject invalid slug on update', async () => {
      const group = await createCategoryGroup();

      await request(ctx.httpServer)
        .patch(`/api/v1/category-groups/${group.id}`)
        .set(withAuth(MANAGE))
        .send({ slug: 'Bad Slug' })
        .expect(400);
    });
  });

  describe('DELETE /api/v1/category-groups/:id', () => {
    it('should delete an empty category group', async () => {
      const group = await createCategoryGroup();

      await request(ctx.httpServer)
        .delete(`/api/v1/category-groups/${group.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/category-groups/${group.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Categories: CRUD ────────────────────────────────────────

  describe('POST /api/v1/category-groups/:groupId/categories', () => {
    it('should create a root category in a group', async () => {
      const group = await createCategoryGroup();
      const cat = await createCategory(group.id, { name: 'Frontend', slug: 'frontend' });

      expect(cat).toMatchObject({
        id: expect.any(String),
        name: 'Frontend',
        slug: 'frontend',
      });
    });

    it('should create a child category with parentId', async () => {
      const group = await createCategoryGroup();
      const parent = await createCategory(group.id, { name: 'Engineering', slug: 'engineering' });
      const child = await createCategory(group.id, {
        name: 'Frontend',
        slug: 'frontend',
        parentId: parent.id,
      });

      expect(child).toMatchObject({
        id: expect.any(String),
        name: 'Frontend',
        parentId: parent.id,
      });
    });

    it('should reject missing name', async () => {
      const group = await createCategoryGroup();

      await request(ctx.httpServer)
        .post(`/api/v1/category-groups/${group.id}/categories`)
        .set(withAuth(MANAGE))
        .send({ slug: 'valid' })
        .expect(400);
    });

    it('should reject invalid slug format', async () => {
      const group = await createCategoryGroup();

      await request(ctx.httpServer)
        .post(`/api/v1/category-groups/${group.id}/categories`)
        .set(withAuth(MANAGE))
        .send({ name: 'Test', slug: 'Not Valid' })
        .expect(400);
    });
  });

  describe('GET /api/v1/category-groups/:groupId/tree', () => {
    it('should return the category tree for a group', async () => {
      const group = await createCategoryGroup();
      const parent = await createCategory(group.id, { name: 'Engineering', slug: 'engineering' });
      await createCategory(group.id, {
        name: 'Frontend',
        slug: 'frontend',
        parentId: parent.id,
      });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/category-groups/${group.id}/tree`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty tree for group with no categories', async () => {
      const group = await createCategoryGroup();

      const res = await request(ctx.httpServer)
        .get(`/api/v1/category-groups/${group.id}/tree`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/v1/categories/:id', () => {
    it('should return a category by ID', async () => {
      const group = await createCategoryGroup();
      const cat = await createCategory(group.id, { name: 'Sales', slug: 'sales' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/categories/${cat.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: cat.id, name: 'Sales' });
    });

    it('should return 404 for non-existent category', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/categories/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('GET /api/v1/categories/:id/ancestors', () => {
    it('should return ancestors of a nested category', async () => {
      const group = await createCategoryGroup();
      const grandparent = await createCategory(group.id, { name: 'Company', slug: 'company' });
      const parent = await createCategory(group.id, {
        name: 'Engineering',
        slug: 'engineering',
        parentId: grandparent.id,
      });
      const child = await createCategory(group.id, {
        name: 'Frontend',
        slug: 'frontend',
        parentId: parent.id,
      });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/categories/${child.id}/ancestors`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for root category', async () => {
      const group = await createCategoryGroup();
      const root = await createCategory(group.id, { name: 'Root', slug: 'root' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/categories/${root.id}/ancestors`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/v1/categories/group/:slug', () => {
    it('should list categories by group slug', async () => {
      const slug = `by-slug-${Date.now()}`;
      const group = await createCategoryGroup({ name: 'BySlug', slug });
      await createCategory(group.id, { name: 'Alpha', slug: `alpha-${Date.now()}` });
      await createCategory(group.id, { name: 'Beta', slug: `beta-${Date.now()}` });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/categories/group/${slug}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PATCH /api/v1/categories/:id', () => {
    it('should update a category', async () => {
      const group = await createCategoryGroup();
      const cat = await createCategory(group.id);

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/categories/${cat.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('should reject invalid slug on update', async () => {
      const group = await createCategoryGroup();
      const cat = await createCategory(group.id);

      await request(ctx.httpServer)
        .patch(`/api/v1/categories/${cat.id}`)
        .set(withAuth(MANAGE))
        .send({ slug: 'Bad Slug' })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/categories/:id/move', () => {
    it('should move a category to a new parent', async () => {
      const group = await createCategoryGroup();
      const cat = await createCategory(group.id, { name: 'Moveable', slug: 'moveable' });
      const newParent = await createCategory(group.id, { name: 'NewParent', slug: 'new-parent' });

      await request(ctx.httpServer)
        .patch(`/api/v1/categories/${cat.id}/move`)
        .set(withAuth(MANAGE))
        .send({ parentId: newParent.id })
        .expect(200);
    });

    it('should move a category to root (null parentId)', async () => {
      const group = await createCategoryGroup();
      const parent = await createCategory(group.id, { name: 'Parent', slug: 'parent' });
      const child = await createCategory(group.id, {
        name: 'Child',
        slug: 'child',
        parentId: parent.id,
      });

      await request(ctx.httpServer)
        .patch(`/api/v1/categories/${child.id}/move`)
        .set(withAuth(MANAGE))
        .send({})
        .expect(200);
    });
  });

  describe('DELETE /api/v1/categories/:id', () => {
    it('should delete a leaf category', async () => {
      const group = await createCategoryGroup();
      const cat = await createCategory(group.id);

      await request(ctx.httpServer)
        .delete(`/api/v1/categories/${cat.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/categories/${cat.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Permission enforcement ──────────────────────────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/category-groups')
        .expect(401);
    });

    it('should return 403 with read-only on write endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/category-groups')
        .set(withAuth(READ))
        .send({ name: 'Test', slug: 'test' })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/category-groups')
        .set(withAuth(['*']))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
