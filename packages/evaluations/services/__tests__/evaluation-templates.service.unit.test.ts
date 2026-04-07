import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EvaluationTemplatesService } from '../evaluation-templates.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
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

describe('EvaluationTemplatesService', () => {
  let service: EvaluationTemplatesService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    const databaseService = { db: mockDb } as any;
    service = new EvaluationTemplatesService(databaseService);
  });

  describe('create', () => {
    it('should create a template and return it', async () => {
      const template = {
        id: 't1',
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [{ name: 'Problem Solving', description: 'Ability to break down problems' }],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb._chain.returning.mockResolvedValueOnce([template]);

      const result = await service.create({
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [{ name: 'Problem Solving', description: 'Ability to break down problems' }],
      });

      expect(result).toEqual(template);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return the template', async () => {
      const template = {
        id: 't1',
        slug: 'tech-interview',
        name: 'Updated Name',
        entityType: 'interviews',
        criteria: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb._chain.returning.mockResolvedValueOnce([template]);

      const result = await service.update('t1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException if not found', async () => {
      mockDb._chain.returning.mockResolvedValueOnce([]);

      await expect(service.update('nonexistent', { name: 'x' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should return existing template if no fields to update', async () => {
      const template = {
        id: 't1',
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(template);

      const result = await service.update('t1', {});
      expect(result).toEqual(template);
    });
  });

  describe('findByIdOrFail', () => {
    it('should return the template when found', async () => {
      const template = {
        id: 't1',
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb._chain.limit.mockResolvedValueOnce([template]);

      const result = await service.findByIdOrFail('t1');
      expect(result).toEqual(template);
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findByIdOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if template not found', async () => {
      vi.spyOn(service, 'findByIdOrFail').mockRejectedValueOnce(new NotFoundException());

      await expect(service.delete('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if evaluations exist', async () => {
      const template = {
        id: 't1',
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(template);
      // count evaluations -> select({total}).from().where()
      mockDb._chain.where.mockResolvedValueOnce([{ total: 5 }]);

      await expect(service.delete('t1'))
        .rejects.toThrow(ConflictException);
    });

    it('should delete when no evaluations exist', async () => {
      const template = {
        id: 't1',
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(template);
      // count evaluations -> select({total}).from().where()
      mockDb._chain.where.mockResolvedValueOnce([{ total: 0 }]);

      await expect(service.delete('t1')).resolves.toBeUndefined();
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('ensureTemplate', () => {
    it('should return existing template if slug exists', async () => {
      const template = {
        id: 't1',
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(service, 'findBySlug').mockResolvedValueOnce(template);

      const result = await service.ensureTemplate({
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [],
      });

      expect(result).toEqual(template);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('should create template if slug does not exist', async () => {
      const template = {
        id: 't1',
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [{ name: 'Problem Solving', description: 'test' }],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.spyOn(service, 'findBySlug').mockResolvedValueOnce(null);
      mockDb._chain.returning.mockResolvedValueOnce([template]);

      const result = await service.ensureTemplate({
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [{ name: 'Problem Solving', description: 'test' }],
      });

      expect(result).toEqual(template);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
