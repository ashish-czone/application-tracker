import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TaxonomyService } from '../taxonomy.service';
import type { TagGroup, Tag } from '../../types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  const methods = [
    'select', 'from', 'where', 'innerJoin', 'leftJoin',
    'limit', 'orderBy', 'offset', 'insert', 'values',
    'returning', 'update', 'set', 'delete', 'onConflictDoNothing',
  ];

  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }

  return {
    db: chain,
    _chain: chain,
  };
}

function buildTagGroup(overrides: Partial<TagGroup> = {}): TagGroup {
  return {
    id: 'g1',
    name: 'Priority',
    slug: 'priority',
    description: null,
    allowMultiple: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function buildTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 't1',
    tagGroupId: 'g1',
    name: 'High',
    slug: 'high',
    color: '#ff0000',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaxonomyService — additional coverage', () => {
  let service: TaxonomyService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb.db } as any;
    service = new TaxonomyService(databaseService);
  });

  // -----------------------------------------------------------------------
  // findTagGroupById
  // -----------------------------------------------------------------------

  describe('findTagGroupById', () => {
    it('should return the tag group when found', async () => {
      const group = buildTagGroup();
      // Terminal call: limit resolves the result array
      mockDb._chain.limit.mockResolvedValueOnce([group]);

      const result = await service.findTagGroupById('g1');

      expect(result).toEqual(group);
      expect(mockDb._chain.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
      expect(mockDb._chain.limit).toHaveBeenCalled();
    });

    it('should return null when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findTagGroupById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // findTagGroupByIdOrFail
  // -----------------------------------------------------------------------

  describe('findTagGroupByIdOrFail', () => {
    it('should return the tag group when found', async () => {
      const group = buildTagGroup();
      mockDb._chain.limit.mockResolvedValueOnce([group]);

      const result = await service.findTagGroupByIdOrFail('g1');

      expect(result).toEqual(group);
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findTagGroupByIdOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findTagGroupByIdOrFail('nonexistent'))
        .rejects.toThrow('Tag group not found');
    });
  });

  // -----------------------------------------------------------------------
  // listTagGroups
  // -----------------------------------------------------------------------

  describe('listTagGroups', () => {
    it('should return paginated results with defaults', async () => {
      const groups = [buildTagGroup(), buildTagGroup({ id: 'g2', name: 'Status', slug: 'status' })];
      // First DB call: count query — terminal at where
      mockDb._chain.where.mockResolvedValueOnce([{ total: 2 }]);
      // Second DB call: data query — terminal at offset
      mockDb._chain.offset.mockResolvedValueOnce(groups);

      const result = await service.listTagGroups({});

      expect(result.data).toEqual(groups);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply custom page and limit', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 50 }]);
      mockDb._chain.offset.mockResolvedValueOnce([buildTagGroup()]);

      const result = await service.listTagGroups({ page: 3, limit: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(5);
    });

    it('should apply search filter', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 1 }]);
      mockDb._chain.offset.mockResolvedValueOnce([buildTagGroup()]);

      const result = await service.listTagGroups({ search: 'prior' });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should return empty data when no results match', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 0 }]);
      mockDb._chain.offset.mockResolvedValueOnce([]);

      const result = await service.listTagGroups({ search: 'nonexistent' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should support sort by name ascending', async () => {
      const groups = [
        buildTagGroup({ id: 'g1', name: 'Alpha' }),
        buildTagGroup({ id: 'g2', name: 'Beta' }),
      ];
      mockDb._chain.where.mockResolvedValueOnce([{ total: 2 }]);
      mockDb._chain.offset.mockResolvedValueOnce(groups);

      const result = await service.listTagGroups({ sort: 'name', order: 'asc' });

      expect(result.data).toHaveLength(2);
      expect(mockDb._chain.orderBy).toHaveBeenCalled();
    });

    it('should support sort by createdAt descending (default)', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 1 }]);
      mockDb._chain.offset.mockResolvedValueOnce([buildTagGroup()]);

      const result = await service.listTagGroups({ order: 'desc' });

      expect(result.data).toHaveLength(1);
      expect(mockDb._chain.orderBy).toHaveBeenCalled();
    });

    it('should calculate correct offset for page 2', async () => {
      mockDb._chain.where.mockResolvedValueOnce([{ total: 30 }]);
      mockDb._chain.offset.mockResolvedValueOnce([buildTagGroup()]);

      const result = await service.listTagGroups({ page: 2, limit: 10 });

      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(3);
      expect(mockDb._chain.limit).toHaveBeenCalled();
      expect(mockDb._chain.offset).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // updateTag
  // -----------------------------------------------------------------------

  describe('updateTag', () => {
    it('should update and return the tag', async () => {
      const updatedTag = buildTag({ name: 'Critical' });
      mockDb._chain.returning.mockResolvedValueOnce([updatedTag]);

      const result = await service.updateTag('t1', { name: 'Critical' });

      expect(result).toEqual(updatedTag);
      expect(result.name).toBe('Critical');
      expect(mockDb._chain.update).toHaveBeenCalled();
      expect(mockDb._chain.set).toHaveBeenCalled();
    });

    it('should update slug field', async () => {
      const updatedTag = buildTag({ slug: 'critical' });
      mockDb._chain.returning.mockResolvedValueOnce([updatedTag]);

      const result = await service.updateTag('t1', { slug: 'critical' });

      expect(result.slug).toBe('critical');
    });

    it('should update color field', async () => {
      const updatedTag = buildTag({ color: '#00ff00' });
      mockDb._chain.returning.mockResolvedValueOnce([updatedTag]);

      const result = await service.updateTag('t1', { color: '#00ff00' });

      expect(result.color).toBe('#00ff00');
    });

    it('should return existing tag when update data is empty', async () => {
      const existingTag = buildTag();
      // updateTag with empty data calls findTagByIdOrFail → findTagById → limit
      mockDb._chain.limit.mockResolvedValueOnce([existingTag]);

      const result = await service.updateTag('t1', {});

      expect(result).toEqual(existingTag);
      // Should NOT have called update since data is empty
      expect(mockDb._chain.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when empty update and tag not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.updateTag('nonexistent', {}))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when tag not found during update', async () => {
      mockDb._chain.returning.mockResolvedValueOnce([]);

      await expect(service.updateTag('nonexistent', { name: 'X' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message', async () => {
      mockDb._chain.returning.mockResolvedValueOnce([]);

      await expect(service.updateTag('nonexistent', { name: 'X' }))
        .rejects.toThrow('Tag not found');
    });
  });

  // -----------------------------------------------------------------------
  // findTagById
  // -----------------------------------------------------------------------

  describe('findTagById', () => {
    it('should return the tag when found', async () => {
      const tag = buildTag();
      mockDb._chain.limit.mockResolvedValueOnce([tag]);

      const result = await service.findTagById('t1');

      expect(result).toEqual(tag);
    });

    it('should return null when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findTagById('nonexistent');

      expect(result).toBeNull();
    });

    it('should query with correct id', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await service.findTagById('specific-id');

      expect(mockDb._chain.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // findTagByIdOrFail
  // -----------------------------------------------------------------------

  describe('findTagByIdOrFail', () => {
    it('should return the tag when found', async () => {
      const tag = buildTag();
      mockDb._chain.limit.mockResolvedValueOnce([tag]);

      const result = await service.findTagByIdOrFail('t1');

      expect(result).toEqual(tag);
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findTagByIdOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with descriptive message', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findTagByIdOrFail('nonexistent'))
        .rejects.toThrow('Tag not found');
    });
  });

  // -----------------------------------------------------------------------
  // listTagsByGroup
  // -----------------------------------------------------------------------

  describe('listTagsByGroup', () => {
    it('should return tags sorted by name for a valid group', async () => {
      const group = buildTagGroup();
      const tagList = [
        buildTag({ id: 't1', name: 'Alpha' }),
        buildTag({ id: 't2', name: 'Beta' }),
      ];
      // findTagGroupByIdOrFail → findTagGroupById → limit
      mockDb._chain.limit.mockResolvedValueOnce([group]);
      // data query terminal: orderBy
      mockDb._chain.orderBy.mockResolvedValueOnce(tagList);

      const result = await service.listTagsByGroup('g1');

      expect(result).toEqual(tagList);
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException if group does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.listTagsByGroup('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should return empty array for group with no tags', async () => {
      const group = buildTagGroup();
      mockDb._chain.limit.mockResolvedValueOnce([group]);
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      const result = await service.listTagsByGroup('g1');

      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // listTagsByGroupSlug
  // -----------------------------------------------------------------------

  describe('listTagsByGroupSlug', () => {
    it('should return tags when group slug is found', async () => {
      const tagList = [
        buildTag({ id: 't1', name: 'High' }),
        buildTag({ id: 't2', name: 'Low' }),
      ];
      // First query: find group by slug → limit
      mockDb._chain.limit.mockResolvedValueOnce([{ id: 'g1' }]);
      // Second query: list tags → orderBy
      mockDb._chain.orderBy.mockResolvedValueOnce(tagList);

      const result = await service.listTagsByGroupSlug('priority');

      expect(result).toEqual(tagList);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when group slug is not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.listTagsByGroupSlug('nonexistent');

      expect(result).toEqual([]);
    });

    it('should return empty array when group exists but has no tags', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ id: 'g1' }]);
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      const result = await service.listTagsByGroupSlug('priority');

      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // listTagOptionsByGroupSlug
  // -----------------------------------------------------------------------

  describe('listTagOptionsByGroupSlug', () => {
    it('should return tag options with value, label, and color', async () => {
      const tagList = [
        buildTag({ id: 't1', name: 'High', color: '#ff0000' }),
        buildTag({ id: 't2', name: 'Medium', color: '#ffaa00' }),
        buildTag({ id: 't3', name: 'Low', color: null }),
      ];
      // Find group by slug → limit
      mockDb._chain.limit
        .mockResolvedValueOnce([{ id: 'g1' }])
        // Second query: list tags → limit (final)
        .mockResolvedValueOnce(tagList);

      const result = await service.listTagOptionsByGroupSlug('priority');

      expect(result).toEqual([
        { value: 't1', label: 'High', color: '#ff0000' },
        { value: 't2', label: 'Medium', color: '#ffaa00' },
        { value: 't3', label: 'Low', color: null },
      ]);
    });

    it('should return empty array when group slug is not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.listTagOptionsByGroupSlug('nonexistent');

      expect(result).toEqual([]);
    });

    it('should apply search filter', async () => {
      const tagList = [buildTag({ id: 't1', name: 'High', color: '#ff0000' })];
      mockDb._chain.limit
        .mockResolvedValueOnce([{ id: 'g1' }])
        .mockResolvedValueOnce(tagList);

      const result = await service.listTagOptionsByGroupSlug('priority', 'high');

      expect(result).toEqual([
        { value: 't1', label: 'High', color: '#ff0000' },
      ]);
    });

    it('should apply custom limit', async () => {
      const tagList = [buildTag({ id: 't1', name: 'High', color: '#ff0000' })];
      mockDb._chain.limit
        .mockResolvedValueOnce([{ id: 'g1' }])
        .mockResolvedValueOnce(tagList);

      const result = await service.listTagOptionsByGroupSlug('priority', undefined, 5);

      expect(result).toHaveLength(1);
      expect(mockDb._chain.limit).toHaveBeenCalled();
    });

    it('should apply both search and limit', async () => {
      mockDb._chain.limit
        .mockResolvedValueOnce([{ id: 'g1' }])
        .mockResolvedValueOnce([]);

      const result = await service.listTagOptionsByGroupSlug('priority', 'xyz', 10);

      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // detachTag
  // -----------------------------------------------------------------------

  describe('detachTag', () => {
    it('should delete the entity tag record', async () => {
      mockDb._chain.where.mockResolvedValueOnce(undefined);

      await expect(service.detachTag('candidate', 'c1', 't1')).resolves.toBeUndefined();
      expect(mockDb._chain.delete).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
    });

    it('should use provided transaction when given', async () => {
      const txChain: Record<string, ReturnType<typeof vi.fn>> = {};
      const methods = ['select', 'from', 'where', 'delete', 'innerJoin', 'limit', 'orderBy'];
      for (const m of methods) {
        txChain[m] = vi.fn().mockReturnValue(txChain);
      }
      txChain.where.mockResolvedValueOnce(undefined);

      await service.detachTag('candidate', 'c1', 't1', txChain);

      expect(txChain.delete).toHaveBeenCalled();
      // The main db should NOT have been used for delete
      expect(mockDb._chain.delete).not.toHaveBeenCalled();
    });

    it('should not throw when entity tag does not exist', async () => {
      mockDb._chain.where.mockResolvedValueOnce(undefined);

      await expect(service.detachTag('candidate', 'c1', 'nonexistent')).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // getTagsForEntity
  // -----------------------------------------------------------------------

  describe('getTagsForEntity', () => {
    it('should return tags with group info for an entity', async () => {
      const tagsWithGroups = [
        {
          id: 't1', tagGroupId: 'g1', name: 'High', slug: 'high',
          color: '#ff0000', createdAt: new Date(), updatedAt: new Date(),
          groupName: 'Priority', groupSlug: 'priority',
        },
        {
          id: 't2', tagGroupId: 'g2', name: 'Sales', slug: 'sales',
          color: null, createdAt: new Date(), updatedAt: new Date(),
          groupName: 'Department', groupSlug: 'department',
        },
      ];
      mockDb._chain.orderBy.mockResolvedValueOnce(tagsWithGroups);

      const result = await service.getTagsForEntity('candidate', 'c1');

      expect(result).toEqual(tagsWithGroups);
      expect(result).toHaveLength(2);
      expect(result[0].groupName).toBe('Priority');
      expect(result[1].groupSlug).toBe('department');
    });

    it('should return empty array when entity has no tags', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      const result = await service.getTagsForEntity('candidate', 'c1');

      expect(result).toEqual([]);
    });

    it('should use provided transaction when given', async () => {
      const txChain: Record<string, ReturnType<typeof vi.fn>> = {};
      const methods = [
        'select', 'from', 'where', 'innerJoin', 'leftJoin',
        'limit', 'orderBy', 'offset', 'delete',
      ];
      for (const m of methods) {
        txChain[m] = vi.fn().mockReturnValue(txChain);
      }
      txChain.orderBy.mockResolvedValueOnce([]);

      const result = await service.getTagsForEntity('candidate', 'c1', txChain);

      expect(result).toEqual([]);
      expect(txChain.select).toHaveBeenCalled();
      expect(txChain.from).toHaveBeenCalled();
      expect(txChain.innerJoin).toHaveBeenCalled();
      // Main db should NOT have been used
      expect(mockDb._chain.select).not.toHaveBeenCalled();
    });

    it('should join entityTags, tags, and tagGroups tables', async () => {
      mockDb._chain.orderBy.mockResolvedValueOnce([]);

      await service.getTagsForEntity('candidate', 'c1');

      expect(mockDb._chain.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      // Two inner joins: tags + tagGroups
      expect(mockDb._chain.innerJoin).toHaveBeenCalledTimes(2);
      expect(mockDb._chain.where).toHaveBeenCalled();
      expect(mockDb._chain.orderBy).toHaveBeenCalled();
    });
  });
});
