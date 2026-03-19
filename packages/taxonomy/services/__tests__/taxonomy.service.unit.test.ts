import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TaxonomyService } from '../taxonomy.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

describe('TaxonomyService', () => {
  let service: TaxonomyService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    service = new TaxonomyService(databaseService);
  });

  // --- Tag Groups ---

  describe('createTagGroup', () => {
    it('should insert a tag group and return it', async () => {
      const group = { id: 'g1', name: 'Priority', slug: 'priority', description: null, allowMultiple: false, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([group]);

      const result = await service.createTagGroup({ name: 'Priority', slug: 'priority', allowMultiple: false });

      expect(result).toEqual(group);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('updateTagGroup', () => {
    it('should update and return the tag group', async () => {
      const group = { id: 'g1', name: 'Updated', slug: 'updated', description: null, allowMultiple: true, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([group]);

      const result = await service.updateTagGroup('g1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb._chain.returning.mockResolvedValueOnce([]);

      await expect(service.updateTagGroup('nonexistent', { name: 'x' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTagGroup', () => {
    it('should throw NotFoundException if not found', async () => {
      vi.spyOn(service, 'findTagGroupById').mockResolvedValueOnce(null);

      await expect(service.deleteTagGroup('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if tags are attached to entities', async () => {
      const group = { id: 'g1', name: 'Priority', slug: 'priority', description: null, allowMultiple: true, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findTagGroupById').mockResolvedValueOnce(group);
      mockDb._chain.where.mockResolvedValueOnce([{ total: 5 }]);

      await expect(service.deleteTagGroup('g1'))
        .rejects.toThrow(ConflictException);
    });

    it('should delete when no tags are attached', async () => {
      const group = { id: 'g1', name: 'Priority', slug: 'priority', description: null, allowMultiple: true, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findTagGroupById').mockResolvedValueOnce(group);
      mockDb._chain.where.mockResolvedValueOnce([{ total: 0 }]);

      await expect(service.deleteTagGroup('g1')).resolves.toBeUndefined();
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  // --- Tags ---

  describe('createTag', () => {
    it('should create a tag within a group', async () => {
      const group = { id: 'g1', name: 'Priority', slug: 'priority', description: null, allowMultiple: true, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findTagGroupByIdOrFail').mockResolvedValueOnce(group);
      const tag = { id: 't1', tagGroupId: 'g1', name: 'High', slug: 'high', color: '#ff0000', createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([tag]);

      const result = await service.createTag({ tagGroupId: 'g1', name: 'High', slug: 'high', color: '#ff0000' });

      expect(result).toEqual(tag);
    });

    it('should throw NotFoundException if group does not exist', async () => {
      vi.spyOn(service, 'findTagGroupByIdOrFail').mockRejectedValueOnce(new NotFoundException());

      await expect(service.createTag({ tagGroupId: 'nonexistent', name: 'X', slug: 'x' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTag', () => {
    it('should throw ConflictException if tag is attached to entities', async () => {
      const tag = { id: 't1', tagGroupId: 'g1', name: 'High', slug: 'high', color: null, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findTagById').mockResolvedValueOnce(tag);
      mockDb._chain.where.mockResolvedValueOnce([{ total: 3 }]);

      await expect(service.deleteTag('t1'))
        .rejects.toThrow(ConflictException);
    });
  });

  // --- Entity Tags ---

  describe('attachTag', () => {
    it('should attach a tag to an entity', async () => {
      const tag = { id: 't1', tagGroupId: 'g1', name: 'High', slug: 'high', color: null, createdAt: new Date(), updatedAt: new Date() };
      const group = { id: 'g1', name: 'Priority', slug: 'priority', description: null, allowMultiple: true, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findTagByIdOrFail').mockResolvedValueOnce(tag);
      vi.spyOn(service, 'findTagGroupByIdOrFail').mockResolvedValueOnce(group);

      await expect(service.attachTag('candidate', 'c1', 't1')).resolves.toBeUndefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw ConflictException when allowMultiple is false and entity already has a tag from the group', async () => {
      const tag = { id: 't2', tagGroupId: 'g1', name: 'Low', slug: 'low', color: null, createdAt: new Date(), updatedAt: new Date() };
      const group = { id: 'g1', name: 'Priority', slug: 'priority', description: null, allowMultiple: false, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findTagByIdOrFail').mockResolvedValueOnce(tag);
      vi.spyOn(service, 'findTagGroupByIdOrFail').mockResolvedValueOnce(group);
      // Entity already has tag t1 from this group
      mockDb._chain.limit.mockResolvedValueOnce([{ tagId: 't1' }]);

      await expect(service.attachTag('candidate', 'c1', 't2'))
        .rejects.toThrow(ConflictException);
    });
  });

  // --- Tag Loader ---

  describe('createTagLoader', () => {
    it('should return empty array for empty input', async () => {
      const withTags = service.createTagLoader('candidate');
      const result = await withTags([]);
      expect(result).toEqual([]);
    });

    it('should batch-load and merge tags onto entities', async () => {
      const entities = [
        { id: 'c1', name: 'Alice' },
        { id: 'c2', name: 'Bob' },
      ];

      mockDb._chain.orderBy.mockResolvedValueOnce([
        { entityId: 'c1', id: 't1', tagGroupId: 'g1', name: 'High', slug: 'high', color: '#ff0000', createdAt: new Date(), updatedAt: new Date(), groupName: 'Priority', groupSlug: 'priority' },
        { entityId: 'c1', id: 't2', tagGroupId: 'g2', name: 'Sales', slug: 'sales', color: null, createdAt: new Date(), updatedAt: new Date(), groupName: 'Department', groupSlug: 'department' },
      ]);

      const withTags = service.createTagLoader('candidate');
      const result = await withTags(entities);

      expect(result[0].tags).toHaveLength(2);
      expect(result[0].tags[0].name).toBe('High');
      expect(result[0].tags[0].groupName).toBe('Priority');
      expect(result[1].tags).toHaveLength(0);
    });
  });
});
