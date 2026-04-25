import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createPackageTestApp, withAuth, cleanDatabase, type PackageTestApp } from '@packages/platform-testing';
import { HierarchyModule } from '@packages/hierarchy';
import { TaxonomyModule } from '../../taxonomy.module';
import { TAXONOMY_PERMISSIONS } from '../../permissions';

const READ = [TAXONOMY_PERMISSIONS.TAG_GROUPS_READ, TAXONOMY_PERMISSIONS.TAGS_READ];
const MANAGE = [...READ, TAXONOMY_PERMISSIONS.TAG_GROUPS_MANAGE, TAXONOMY_PERMISSIONS.TAGS_MANAGE];
const ENTITY_TAGS = [...READ, TAXONOMY_PERMISSIONS.ENTITY_TAGS_MANAGE];

describe('TagsController (integration)', () => {
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

  async function createTagGroup(overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: 'Priority',
      slug: `priority-${Date.now()}-${seq}`,
      description: 'Priority levels',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post('/api/v1/tag-groups')
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  async function createTag(groupId: string, overrides: Record<string, unknown> = {}) {
    seq++;
    const body = {
      name: 'High',
      slug: `high-${Date.now()}-${seq}`,
      color: '#ef4444',
      ...overrides,
    };
    const res = await request(ctx.httpServer)
      .post(`/api/v1/tag-groups/${groupId}/tags`)
      .set(withAuth(MANAGE))
      .send(body)
      .expect(201);
    return res.body;
  }

  // ── Tag Groups: CRUD ────────────────────────────────────────

  describe('POST /api/v1/tag-groups', () => {
    it('should create a tag group', async () => {
      const group = await createTagGroup({ name: 'Status', slug: 'status' });

      expect(group).toMatchObject({
        id: expect.any(String),
        name: 'Status',
        slug: 'status',
      });
    });

    it('should reject missing name', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/tag-groups')
        .set(withAuth(MANAGE))
        .send({ slug: 'valid-slug' })
        .expect(400);
    });

    it('should reject invalid slug format', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/tag-groups')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', slug: 'Invalid Slug' })
        .expect(400);
    });

    it('should reject unknown properties', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/tag-groups')
        .set(withAuth(MANAGE))
        .send({ name: 'Test', slug: 'test', hackField: 'injected' })
        .expect(400);
    });
  });

  describe('GET /api/v1/tag-groups', () => {
    it('should list tag groups with pagination', async () => {
      await createTagGroup({ name: 'Alpha', slug: 'alpha' });
      await createTagGroup({ name: 'Beta', slug: 'beta' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/tag-groups')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toMatchObject({
        page: 1,
        total: 2,
      });
    });

    it('should filter by search', async () => {
      await createTagGroup({ name: 'Priority', slug: 'priority' });
      await createTagGroup({ name: 'Status', slug: 'status' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/tag-groups?search=prior')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Priority');
    });

    it('should paginate', async () => {
      await createTagGroup({ name: 'Alpha', slug: 'alpha' });
      await createTagGroup({ name: 'Beta', slug: 'beta' });
      await createTagGroup({ name: 'Gamma', slug: 'gamma' });

      const res = await request(ctx.httpServer)
        .get('/api/v1/tag-groups?page=1&limit=2&sort=name&order=asc')
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Alpha');
      expect(res.body.meta.total).toBe(3);
    });
  });

  describe('GET /api/v1/tag-groups/:id', () => {
    it('should return a tag group by ID', async () => {
      const group = await createTagGroup({ name: 'Priority', slug: 'priority' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/tag-groups/${group.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: group.id, name: 'Priority' });
    });

    it('should return 404 for non-existent ID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/tag-groups/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/tag-groups/not-a-uuid')
        .set(withAuth(READ))
        .expect(400);
    });
  });

  describe('PATCH /api/v1/tag-groups/:id', () => {
    it('should update a tag group', async () => {
      const group = await createTagGroup({ name: 'Old', slug: 'old' });

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/tag-groups/${group.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.name).toBe('New Name');
    });

    it('should reject invalid slug on update', async () => {
      const group = await createTagGroup();

      await request(ctx.httpServer)
        .patch(`/api/v1/tag-groups/${group.id}`)
        .set(withAuth(MANAGE))
        .send({ slug: 'Bad Slug' })
        .expect(400);
    });
  });

  describe('DELETE /api/v1/tag-groups/:id', () => {
    it('should delete an empty tag group', async () => {
      const group = await createTagGroup();

      await request(ctx.httpServer)
        .delete(`/api/v1/tag-groups/${group.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/tag-groups/${group.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Tags: CRUD ──────────────────────────────────────────────

  describe('POST /api/v1/tag-groups/:groupId/tags', () => {
    it('should create a tag in a group', async () => {
      const group = await createTagGroup();
      const tag = await createTag(group.id, { name: 'Urgent', slug: 'urgent' });

      expect(tag).toMatchObject({
        id: expect.any(String),
        name: 'Urgent',
        slug: 'urgent',
        tagGroupId: group.id,
      });
    });

    it('should reject missing name', async () => {
      const group = await createTagGroup();

      await request(ctx.httpServer)
        .post(`/api/v1/tag-groups/${group.id}/tags`)
        .set(withAuth(MANAGE))
        .send({ slug: 'valid' })
        .expect(400);
    });

    it('should reject invalid slug format', async () => {
      const group = await createTagGroup();

      await request(ctx.httpServer)
        .post(`/api/v1/tag-groups/${group.id}/tags`)
        .set(withAuth(MANAGE))
        .send({ name: 'Test', slug: 'Not Valid' })
        .expect(400);
    });
  });

  describe('GET /api/v1/tag-groups/:groupId/tags', () => {
    it('should list tags in a group', async () => {
      const group = await createTagGroup();
      await createTag(group.id, { name: 'High', slug: 'high' });
      await createTag(group.id, { name: 'Low', slug: 'low' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/tag-groups/${group.id}/tags`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('should return empty array for group with no tags', async () => {
      const group = await createTagGroup();

      const res = await request(ctx.httpServer)
        .get(`/api/v1/tag-groups/${group.id}/tags`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/v1/tags/group/:slug', () => {
    it('should list tags by group slug', async () => {
      const slug = `by-slug-${Date.now()}`;
      const group = await createTagGroup({ name: 'BySlug', slug });
      await createTag(group.id, { name: 'A', slug: `a-${Date.now()}` });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/tags/group/${slug}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/tags/:id', () => {
    it('should return a tag by ID', async () => {
      const group = await createTagGroup();
      const tag = await createTag(group.id, { name: 'Critical', slug: 'critical' });

      const res = await request(ctx.httpServer)
        .get(`/api/v1/tags/${tag.id}`)
        .set(withAuth(READ))
        .expect(200);

      expect(res.body).toMatchObject({ id: tag.id, name: 'Critical' });
    });

    it('should return 404 for non-existent tag', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/tags/00000000-0000-0000-0000-000000000000')
        .set(withAuth(READ))
        .expect(404);
    });
  });

  describe('PATCH /api/v1/tags/:id', () => {
    it('should update a tag', async () => {
      const group = await createTagGroup();
      const tag = await createTag(group.id);

      const res = await request(ctx.httpServer)
        .patch(`/api/v1/tags/${tag.id}`)
        .set(withAuth(MANAGE))
        .send({ name: 'Updated', color: '#22c55e' })
        .expect(200);

      expect(res.body.name).toBe('Updated');
      expect(res.body.color).toBe('#22c55e');
    });
  });

  describe('DELETE /api/v1/tags/:id', () => {
    it('should delete a tag', async () => {
      const group = await createTagGroup();
      const tag = await createTag(group.id);

      await request(ctx.httpServer)
        .delete(`/api/v1/tags/${tag.id}`)
        .set(withAuth(MANAGE))
        .expect(204);

      await request(ctx.httpServer)
        .get(`/api/v1/tags/${tag.id}`)
        .set(withAuth(READ))
        .expect(404);
    });
  });

  // ── Entity tags (polymorphic) ──────────────────────────────

  describe('Entity tags endpoints', () => {
    const ENTITY_TYPE = 'tasks';
    const ENTITY_ID = '11111111-1111-4111-8111-111111111111';
    const OTHER_ENTITY_ID = '22222222-2222-4222-8222-222222222222';

    it('PUT replaces tags within the named group only', async () => {
      const taskGroup = await createTagGroup({ name: 'Task Tags', slug: 'task-tags-1' });
      const otherGroup = await createTagGroup({ name: 'Other', slug: 'other-tags-1' });
      const tagA = await createTag(taskGroup.id, { name: 'Urgent', slug: 'urgent' });
      const tagB = await createTag(taskGroup.id, { name: 'Blocked', slug: 'blocked' });
      const tagOther = await createTag(otherGroup.id, { name: 'Pinned', slug: 'pinned' });

      // Seed entity with one task-tag and one other-group tag
      await request(ctx.httpServer)
        .put(`/api/v1/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`)
        .set(withAuth(ENTITY_TAGS))
        .send({ groupSlug: 'task-tags-1', tagIds: [tagA.id] })
        .expect(200);
      await request(ctx.httpServer)
        .put(`/api/v1/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`)
        .set(withAuth(ENTITY_TAGS))
        .send({ groupSlug: 'other-tags-1', tagIds: [tagOther.id] })
        .expect(200);

      // Replace task-tags with tagB only — tagOther must survive
      const res = await request(ctx.httpServer)
        .put(`/api/v1/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`)
        .set(withAuth(ENTITY_TAGS))
        .send({ groupSlug: 'task-tags-1', tagIds: [tagB.id] })
        .expect(200);

      const ids = (res.body as Array<{ id: string }>).map((t) => t.id).sort();
      expect(ids).toEqual([tagB.id, tagOther.id].sort());
    });

    it('GET returns only tags attached to the given entity', async () => {
      const group = await createTagGroup({ name: 'Task Tags', slug: 'task-tags-2' });
      const tag = await createTag(group.id, { name: 'Urgent', slug: 'urgent-2' });

      await request(ctx.httpServer)
        .put(`/api/v1/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`)
        .set(withAuth(ENTITY_TAGS))
        .send({ groupSlug: 'task-tags-2', tagIds: [tag.id] })
        .expect(200);

      const res = await request(ctx.httpServer)
        .get(`/api/v1/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`)
        .set(withAuth(READ))
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(tag.id);

      const other = await request(ctx.httpServer)
        .get(`/api/v1/entities/${ENTITY_TYPE}/${OTHER_ENTITY_ID}/tags`)
        .set(withAuth(READ))
        .expect(200);
      expect(other.body).toHaveLength(0);
    });

    it('PUT rejects tags that do not belong to the declared group', async () => {
      const group = await createTagGroup({ name: 'Task Tags', slug: 'task-tags-3' });
      const otherGroup = await createTagGroup({ name: 'Other', slug: 'other-tags-3' });
      const foreignTag = await createTag(otherGroup.id, { name: 'Foreign', slug: 'foreign-3' });

      await request(ctx.httpServer)
        .put(`/api/v1/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`)
        .set(withAuth(ENTITY_TAGS))
        .send({ groupSlug: 'task-tags-3', tagIds: [foreignTag.id] })
        .expect(404);

      // Confirm no tags were attached
      const res = await request(ctx.httpServer)
        .get(`/api/v1/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`)
        .set(withAuth(READ))
        .expect(200);
      expect(res.body).toHaveLength(0);
      // Silence unused-var lint
      expect(group.id).toBeDefined();
    });

    it('PUT returns 401 without auth', async () => {
      await request(ctx.httpServer)
        .put(`/api/v1/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`)
        .send({ groupSlug: 'task-tags', tagIds: [] })
        .expect(401);
    });

    it('PUT returns 403 with read-only permissions', async () => {
      await request(ctx.httpServer)
        .put(`/api/v1/entities/${ENTITY_TYPE}/${ENTITY_ID}/tags`)
        .set(withAuth(READ))
        .send({ groupSlug: 'task-tags', tagIds: [] })
        .expect(403);
    });
  });

  // ── Auth / Permission checks (package-level) ───────────────

  describe('Permission enforcement', () => {
    it('should return 401 without auth header', async () => {
      await request(ctx.httpServer)
        .get('/api/v1/tag-groups')
        .expect(401);
    });

    it('should return 403 with read-only permissions on write endpoint', async () => {
      await request(ctx.httpServer)
        .post('/api/v1/tag-groups')
        .set(withAuth(READ))
        .send({ name: 'Test', slug: 'test' })
        .expect(403);
    });

    it('should allow superadmin wildcard', async () => {
      const res = await request(ctx.httpServer)
        .get('/api/v1/tag-groups')
        .set(withAuth(['*']))
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });
});
