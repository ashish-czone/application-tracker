import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EvaluationsService } from '../evaluations.service';

function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
  };

  const mockTx = {
    insert: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
    _chain: mockChain,
    _tx: mockTx,
  };
}

const mockTemplate = {
  id: 'tmpl-1',
  slug: 'tech-interview',
  name: 'Technical Interview',
  entityType: 'interviews',
  criteria: [
    { name: 'Problem Solving', description: 'Ability to break down problems' },
    { name: 'Code Quality', description: 'Clean code' },
  ],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEvaluation = {
  id: 'eval-1',
  templateId: 'tmpl-1',
  entityType: 'interviews',
  entityId: 'interview-123',
  evaluatorId: 'user-1',
  overallRating: 4,
  comment: null,
  submittedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  scores: [],
  template: mockTemplate,
};

describe('EvaluationsService', () => {
  let service: EvaluationsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockTemplatesService: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    mockDb = createMockDb();
    mockTemplatesService = {
      findByIdOrFail: vi.fn().mockResolvedValue(mockTemplate),
    };
    mockEventEmitter = {
      emit: vi.fn(),
    };

    const databaseService = { db: mockDb } as any;
    service = new EvaluationsService(databaseService, mockEventEmitter, mockTemplatesService);
  });

  describe('create', () => {
    it('should create an evaluation with scores in a transaction', async () => {
      const evaluation = {
        id: 'eval-1',
        templateId: 'tmpl-1',
        entityType: 'interviews',
        entityId: 'interview-123',
        evaluatorId: 'user-1',
        overallRating: 4,
        comment: 'Good candidate',
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const scores = [
        { id: 's1', evaluationId: 'eval-1', criteriaName: 'Problem Solving', score: 4, note: null, createdAt: new Date() },
        { id: 's2', evaluationId: 'eval-1', criteriaName: 'Code Quality', score: 5, note: null, createdAt: new Date() },
      ];

      // Transaction: insert evaluation, then insert scores
      mockDb._chain.returning
        .mockResolvedValueOnce([evaluation])
        .mockResolvedValueOnce(scores);

      const result = await service.create({
        templateId: 'tmpl-1',
        entityType: 'interviews',
        entityId: 'interview-123',
        evaluatorId: 'user-1',
        overallRating: 4,
        comment: 'Good candidate',
        scores: [
          { criteriaName: 'Problem Solving', score: 4 },
          { criteriaName: 'Code Quality', score: 5 },
        ],
      });

      expect(result.id).toBe('eval-1');
      expect(result.scores).toHaveLength(2);
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'evaluations.EvaluationSubmitted',
        expect.objectContaining({ entityId: 'eval-1' }),
      );
    });

    it('should throw BadRequestException for missing criteria', async () => {
      await expect(service.create({
        templateId: 'tmpl-1',
        entityType: 'interviews',
        entityId: 'interview-123',
        evaluatorId: 'user-1',
        overallRating: 4,
        scores: [
          { criteriaName: 'Problem Solving', score: 4 },
        ],
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unknown criteria', async () => {
      await expect(service.create({
        templateId: 'tmpl-1',
        entityType: 'interviews',
        entityId: 'interview-123',
        evaluatorId: 'user-1',
        overallRating: 4,
        scores: [
          { criteriaName: 'Problem Solving', score: 4 },
          { criteriaName: 'Code Quality', score: 5 },
          { criteriaName: 'Unknown Criteria', score: 3 },
        ],
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for score out of range', async () => {
      await expect(service.create({
        templateId: 'tmpl-1',
        entityType: 'interviews',
        entityId: 'interview-123',
        evaluatorId: 'user-1',
        overallRating: 4,
        scores: [
          { criteriaName: 'Problem Solving', score: 6 },
          { criteriaName: 'Code Quality', score: 5 },
        ],
      })).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when template not found', async () => {
      mockTemplatesService.findByIdOrFail.mockRejectedValueOnce(new NotFoundException());

      await expect(service.create({
        templateId: 'nonexistent',
        entityType: 'interviews',
        entityId: 'interview-123',
        evaluatorId: 'user-1',
        overallRating: 4,
        scores: [],
      })).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException when actor is not the evaluator', async () => {
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(mockEvaluation);

      await expect(service.update('eval-1', { overallRating: 5 }, 'other-user'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it('should throw ForbiddenException when actor is not the evaluator', async () => {
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(mockEvaluation);

      await expect(service.delete('eval-1', 'other-user'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should delete and emit event when actor is the evaluator', async () => {
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(mockEvaluation);

      await service.delete('eval-1', 'user-1');

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'evaluations.EvaluationDeleted',
        expect.objectContaining({ entityId: 'eval-1' }),
      );
    });
  });

  describe('findByIdOrFail', () => {
    it('should throw NotFoundException when not found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findByIdOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
