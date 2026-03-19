import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CategoryService } from '../category.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

describe('CategoryService', () => {
  let service: CategoryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    service = new CategoryService(databaseService);
  });

  // --- Category Groups ---

  describe('createCategoryGroup', () => {
    it('should insert a category group and return it', async () => {
      const group = { id: 'g1', name: 'Departments', slug: 'departments', description: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([group]);

      const result = await service.createCategoryGroup({ name: 'Departments', slug: 'departments' });

      expect(result).toEqual(group);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('deleteCategoryGroup', () => {
    it('should throw NotFoundException if not found', async () => {
      vi.spyOn(service, 'findCategoryGroupById').mockResolvedValueOnce(null);

      await expect(service.deleteCategoryGroup('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if group has categories', async () => {
      const group = { id: 'g1', name: 'Departments', slug: 'departments', description: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findCategoryGroupById').mockResolvedValueOnce(group);
      mockDb._chain.where.mockResolvedValueOnce([{ total: 3 }]);

      await expect(service.deleteCategoryGroup('g1'))
        .rejects.toThrow(ConflictException);
    });
  });

  // --- Categories ---

  describe('createCategory', () => {
    it('should create a root category', async () => {
      const group = { id: 'g1', name: 'Departments', slug: 'departments', description: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findCategoryGroupByIdOrFail').mockResolvedValueOnce(group);
      const cat = { id: 'c1', groupId: 'g1', parentId: null, name: 'Engineering', slug: 'engineering', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([cat]);

      const result = await service.createCategory({ groupId: 'g1', name: 'Engineering', slug: 'engineering' });

      expect(result).toEqual(cat);
    });

    it('should reject parent from different group', async () => {
      const group = { id: 'g1', name: 'Departments', slug: 'departments', description: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findCategoryGroupByIdOrFail').mockResolvedValueOnce(group);
      const parent = { id: 'c2', groupId: 'g2', parentId: null, name: 'Other', slug: 'other', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findCategoryByIdOrFail').mockResolvedValueOnce(parent);

      await expect(service.createCategory({ groupId: 'g1', parentId: 'c2', name: 'X', slug: 'x' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('deleteCategory', () => {
    it('should throw ConflictException if category has children', async () => {
      const cat = { id: 'c1', groupId: 'g1', parentId: null, name: 'Eng', slug: 'eng', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findCategoryById').mockResolvedValueOnce(cat);
      mockDb._chain.where.mockResolvedValueOnce([{ total: 2 }]);

      await expect(service.deleteCategory('c1'))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('moveCategory', () => {
    it('should reject moving category to itself', async () => {
      const cat = { id: 'c1', groupId: 'g1', parentId: null, name: 'Eng', slug: 'eng', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findCategoryByIdOrFail').mockResolvedValueOnce(cat);

      await expect(service.moveCategory('c1', 'c1'))
        .rejects.toThrow(ConflictException);
    });

    it('should reject moving to a different group', async () => {
      const cat = { id: 'c1', groupId: 'g1', parentId: null, name: 'Eng', slug: 'eng', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      const target = { id: 'c2', groupId: 'g2', parentId: null, name: 'Other', slug: 'other', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findCategoryByIdOrFail')
        .mockResolvedValueOnce(cat)
        .mockResolvedValueOnce(target);

      await expect(service.moveCategory('c1', 'c2'))
        .rejects.toThrow(ConflictException);
    });
  });

  // --- Tree Operations ---

  describe('buildTree (via getTree)', () => {
    it('should build nested tree from flat list', async () => {
      const group = { id: 'g1', name: 'Departments', slug: 'departments', description: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findCategoryGroupByIdOrFail').mockResolvedValueOnce(group);

      const now = new Date();
      const flatList = [
        { id: 'c1', groupId: 'g1', parentId: null, name: 'Engineering', slug: 'engineering', sortOrder: 0, createdAt: now, updatedAt: now },
        { id: 'c2', groupId: 'g1', parentId: 'c1', name: 'Frontend', slug: 'frontend', sortOrder: 0, createdAt: now, updatedAt: now },
        { id: 'c3', groupId: 'g1', parentId: 'c1', name: 'Backend', slug: 'backend', sortOrder: 1, createdAt: now, updatedAt: now },
        { id: 'c4', groupId: 'g1', parentId: null, name: 'Sales', slug: 'sales', sortOrder: 1, createdAt: now, updatedAt: now },
      ];
      mockDb._chain.orderBy.mockResolvedValueOnce(flatList);

      const tree = await service.getTree('g1');

      expect(tree).toHaveLength(2);
      expect(tree[0].name).toBe('Engineering');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].name).toBe('Frontend');
      expect(tree[0].children[1].name).toBe('Backend');
      expect(tree[1].name).toBe('Sales');
      expect(tree[1].children).toHaveLength(0);
    });
  });

  describe('validateCategoryInGroup', () => {
    it('should throw if category belongs to wrong group', async () => {
      const cat = { id: 'c1', groupId: 'g1', parentId: null, name: 'Eng', slug: 'eng', sortOrder: 0, createdAt: new Date(), updatedAt: new Date() };
      vi.spyOn(service, 'findCategoryByIdOrFail').mockResolvedValueOnce(cat);
      // Return group with different slug
      mockDb._chain.limit.mockResolvedValueOnce([{ id: 'g1', slug: 'locations' }]);

      await expect(service.validateCategoryInGroup('c1', 'departments'))
        .rejects.toThrow(ConflictException);
    });
  });
});
