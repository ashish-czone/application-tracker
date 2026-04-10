import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { HierarchyModule } from '@packages/hierarchy';
import { TaxonomyModule } from '../../taxonomy.module';
import { TaxonomyService } from '../taxonomy.service';
import { CategoryService } from '../category.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';

describe('Taxonomy (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let taxonomyService: TaxonomyService;
  let categoryService: CategoryService;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      imports: [HierarchyModule, TaxonomyModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    taxonomyService = module.get(TaxonomyService);
    categoryService = module.get(CategoryService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('Tag Groups', () => {
    it('should create and retrieve a tag group', async () => {
      const group = await taxonomyService.createTagGroup({
        name: 'Skills',
        slug: 'skills',
        description: 'Technical skills',
        allowMultiple: true,
      });

      expect(group.id).toBeDefined();
      expect(group.name).toBe('Skills');
      expect(group.slug).toBe('skills');

      const found = await taxonomyService.findTagGroupByIdOrFail(group.id);
      expect(found.name).toBe('Skills');
    });

    it('should list tag groups with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await taxonomyService.createTagGroup({ name: `Group ${i}`, slug: `group-${i}` });
      }

      const result = await taxonomyService.listTagGroups({ page: 1, limit: 3 });
      expect(result.data).toHaveLength(3);
      expect(result.meta.total).toBe(5);
    });

    it('should update a tag group', async () => {
      const group = await taxonomyService.createTagGroup({ name: 'Old', slug: 'old' });
      const updated = await taxonomyService.updateTagGroup(group.id, { name: 'New' });
      expect(updated.name).toBe('New');
    });

    it('should delete a tag group', async () => {
      const group = await taxonomyService.createTagGroup({ name: 'Temp', slug: 'temp' });
      await taxonomyService.deleteTagGroup(group.id);
      expect(await taxonomyService.findTagGroupById(group.id)).toBeNull();
    });
  });

  describe('Tags', () => {
    it('should create tags in a group', async () => {
      const group = await taxonomyService.createTagGroup({ name: 'Priority', slug: 'priority' });
      const tag = await taxonomyService.createTag({
        tagGroupId: group.id,
        name: 'High',
        slug: 'high',
        color: '#ff0000',
      });

      expect(tag.id).toBeDefined();
      expect(tag.name).toBe('High');
      expect(tag.color).toBe('#ff0000');
    });

    it('should list tags by group', async () => {
      const group = await taxonomyService.createTagGroup({ name: 'Status', slug: 'status' });
      await taxonomyService.createTag({ tagGroupId: group.id, name: 'Active', slug: 'active' });
      await taxonomyService.createTag({ tagGroupId: group.id, name: 'Inactive', slug: 'inactive' });

      const tags = await taxonomyService.listTagsByGroup(group.id);
      expect(tags).toHaveLength(2);
    });

    it('should list tags by group slug', async () => {
      const group = await taxonomyService.createTagGroup({ name: 'Level', slug: 'level' });
      await taxonomyService.createTag({ tagGroupId: group.id, name: 'Junior', slug: 'junior' });
      await taxonomyService.createTag({ tagGroupId: group.id, name: 'Senior', slug: 'senior' });

      const tags = await taxonomyService.listTagsByGroupSlug('level');
      expect(tags).toHaveLength(2);
    });

    it('should update a tag', async () => {
      const group = await taxonomyService.createTagGroup({ name: 'Tags', slug: 'tags' });
      const tag = await taxonomyService.createTag({ tagGroupId: group.id, name: 'Old', slug: 'old-tag' });
      const updated = await taxonomyService.updateTag(tag.id, { name: 'New', color: '#00ff00' });
      expect(updated.name).toBe('New');
      expect(updated.color).toBe('#00ff00');
    });

    it('should delete a tag', async () => {
      const group = await taxonomyService.createTagGroup({ name: 'Temp', slug: 'temp-tags' });
      const tag = await taxonomyService.createTag({ tagGroupId: group.id, name: 'Delete Me', slug: 'delete-me' });
      await taxonomyService.deleteTag(tag.id);
      expect(await taxonomyService.findTagById(tag.id)).toBeNull();
    });
  });

  describe('Entity tagging', () => {
    it('should attach and detach tags from entities', async () => {
      const group = await taxonomyService.createTagGroup({ name: 'Skills', slug: 'entity-skills' });
      const tag1 = await taxonomyService.createTag({ tagGroupId: group.id, name: 'JS', slug: 'js' });
      const tag2 = await taxonomyService.createTag({ tagGroupId: group.id, name: 'TS', slug: 'ts' });

      const entityId = 'entity-123';
      await taxonomyService.attachTag('test_entity', entityId, tag1.id);
      await taxonomyService.attachTag('test_entity', entityId, tag2.id);

      let tags = await taxonomyService.getTagsForEntity('test_entity', entityId);
      expect(tags).toHaveLength(2);

      await taxonomyService.detachTag('test_entity', entityId, tag1.id);
      tags = await taxonomyService.getTagsForEntity('test_entity', entityId);
      expect(tags).toHaveLength(1);
      expect(tags[0].name).toBe('TS');
    });
  });

  describe('Category Groups', () => {
    it('should create and list category groups', async () => {
      await categoryService.createCategoryGroup({ name: 'Industries', slug: 'industries' });
      await categoryService.createCategoryGroup({ name: 'Departments', slug: 'departments' });

      const groups = await categoryService.listCategoryGroups();
      expect(groups.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Categories (hierarchical)', () => {
    it('should create categories with hierarchy', async () => {
      const group = await categoryService.createCategoryGroup({ name: 'Locations', slug: 'locations' });
      const parent = await categoryService.createCategory({
        groupId: group.id,
        name: 'North America',
        slug: 'na',
      });
      const child = await categoryService.createCategory({
        groupId: group.id,
        parentId: parent.id,
        name: 'United States',
        slug: 'us',
      });

      expect(child.id).toBeDefined();

      const tree = await categoryService.getTree(group.id);
      expect(tree.length).toBeGreaterThanOrEqual(1);
    });

    it('should update and delete categories', async () => {
      const group = await categoryService.createCategoryGroup({ name: 'Temp', slug: 'temp-cats' });
      const cat = await categoryService.createCategory({
        groupId: group.id,
        name: 'Original',
        slug: 'original',
      });

      const updated = await categoryService.updateCategory(cat.id, { name: 'Updated' });
      expect(updated.name).toBe('Updated');

      await categoryService.deleteCategory(cat.id);
      expect(await categoryService.findCategoryById(cat.id)).toBeNull();
    });
  });
});
