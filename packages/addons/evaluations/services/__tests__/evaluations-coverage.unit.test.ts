import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { EvaluationsService } from '../evaluations.service';
import {
  EVALUATIONS_EVALUATION_UPDATED,
} from '../../events/types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock DB where every method returns `this` by default.
 * Individual methods can be overridden per-call with mockReturnValueOnce /
 * mockResolvedValueOnce to act as terminal (resolve a value) or continue
 * the chain (return `this`).
 */
function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  const methods = [
    'select', 'from', 'where', 'leftJoin', 'innerJoin',
    'limit', 'orderBy', 'offset', 'insert', 'values',
    'returning', 'update', 'set', 'delete', 'groupBy',
  ];

  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }

  return {
    db: chain,
    _chain: chain,
  };
}

function buildTemplate(overrides: Record<string, any> = {}) {
  return {
    id: 'tmpl-1',
    slug: 'tech-interview',
    name: 'Technical Interview',
    entityType: 'interviews',
    criteria: [
      { name: 'Problem Solving', description: 'Ability to break down problems' },
      { name: 'Code Quality', description: 'Clean code' },
    ],
    blindingEnabled: false,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function buildEvaluation(overrides: Record<string, any> = {}) {
  return {
    id: 'eval-1',
    templateId: 'tmpl-1',
    entityType: 'interviews',
    entityId: 'interview-123',
    evaluatorId: 'user-1',
    overallRating: 4,
    recommendation: 'yes',
    comment: 'Good candidate',
    submittedAt: new Date('2026-01-10'),
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-10'),
    ...overrides,
  };
}

function buildScore(overrides: Record<string, any> = {}) {
  return {
    id: 's-1',
    evaluationId: 'eval-1',
    criteriaName: 'Problem Solving',
    score: 4,
    note: null,
    createdAt: new Date('2026-01-10'),
    ...overrides,
  };
}

function buildMockTx() {
  return {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EvaluationsService - extended coverage', () => {
  let service: EvaluationsService;
  let mock: ReturnType<typeof createMockDb>;
  let mockTemplatesService: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    mock = createMockDb();
    mockTemplatesService = {
      findByIdOrFail: vi.fn().mockResolvedValue(buildTemplate()),
    };
    mockEventEmitter = { emit: vi.fn() };

    const databaseService = { db: mock.db } as any;
    service = new EvaluationsService(databaseService, mockEventEmitter, mockTemplatesService);
  });

  // -----------------------------------------------------------------------
  // findById
  // -----------------------------------------------------------------------
  //
  // Chain shape:
  //   1. select().from(evaluations).where().limit(1)                   -> [row] or []
  //   2. select().from(evaluationScores).where()                       -> scores[]
  //   3. select().from(evaluationTemplates).where().limit(1)           -> [template] or []
  //
  // "limit" is terminal for queries 1 & 3.
  // "where" is terminal for query 2 (scores).

  describe('findById', () => {
    it('should return null when evaluation is not found', async () => {
      // Query 1: limit resolves to []
      mock._chain.limit.mockResolvedValueOnce([]);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return evaluation with empty scores and template when found', async () => {
      const evaluation = buildEvaluation();
      const template = buildTemplate();

      // Query 1: where -> chain, limit -> [evaluation]
      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([evaluation]);
      // Query 2 (scores): where -> []
      mock._chain.where.mockResolvedValueOnce([]);
      // Query 3 (template): where -> chain, limit -> [template]
      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([template]);

      const result = await service.findById('eval-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('eval-1');
      expect(result!.scores).toEqual([]);
      expect(result!.template).toEqual(template);
    });

    it('should return evaluation with scores when scores exist', async () => {
      const evaluation = buildEvaluation();
      const scores = [
        buildScore({ id: 's-1', criteriaName: 'Problem Solving', score: 4 }),
        buildScore({ id: 's-2', criteriaName: 'Code Quality', score: 5 }),
      ];
      const template = buildTemplate();

      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([evaluation]);
      mock._chain.where.mockResolvedValueOnce(scores);
      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([template]);

      const result = await service.findById('eval-1');

      expect(result).not.toBeNull();
      expect(result!.scores).toHaveLength(2);
      expect(result!.scores[0].criteriaName).toBe('Problem Solving');
      expect(result!.scores[1].criteriaName).toBe('Code Quality');
    });

    it('should return evaluation without template when template not found', async () => {
      const evaluation = buildEvaluation();

      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([evaluation]);
      mock._chain.where.mockResolvedValueOnce([]);
      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([]); // template not found

      const result = await service.findById('eval-1');

      expect(result).not.toBeNull();
      expect(result!.template).toBeUndefined();
    });

    it('should cast recommendation as Recommendation type', async () => {
      const evaluation = buildEvaluation({ recommendation: 'strong_yes' });
      const template = buildTemplate();

      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([evaluation]);
      mock._chain.where.mockResolvedValueOnce([]);
      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([template]);

      const result = await service.findById('eval-1');

      expect(result!.recommendation).toBe('strong_yes');
    });

    it('should handle null recommendation', async () => {
      const evaluation = buildEvaluation({ recommendation: null });
      const template = buildTemplate();

      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([evaluation]);
      mock._chain.where.mockResolvedValueOnce([]);
      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([template]);

      const result = await service.findById('eval-1');

      expect(result!.recommendation).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // listForEntity
  // -----------------------------------------------------------------------
  //
  // Chain shape (Promise.all):
  //   Query 1: select().from().leftJoin().where().orderBy().limit().offset()  -> rows
  //   Query 2: select({total}).from().where()                                  -> [{total}]
  //
  // After Promise.all:
  //   loadScoresForEvaluations: select().from(evaluationScores).where(inArray) -> scores[]
  //   getBlindedTemplateIds:    select().from(evaluationTemplates).where(inArray) -> templates[]
  //
  // In Query 1, "limit" returns chain (not terminal — offset is terminal).
  // In Query 2, "where" is terminal (resolves to [{total}]).

  describe('listForEntity', () => {
    /**
     * Helper to set up the two parallel queries in listForEntity.
     * Query 1 terminates at offset(), Query 2 terminates at where().
     */
    function setupListQueries(
      rows: any[],
      total: number,
      scores: any[] = [],
      blindedTemplates?: any[],
    ) {
      // Query 1: ...where().orderBy().limit().offset() — limit must chain, offset is terminal
      mock._chain.where.mockReturnValueOnce(mock._chain); // Q1 where -> chain
      mock._chain.limit.mockReturnValueOnce(mock._chain); // Q1 limit -> chain (NOT terminal here)
      mock._chain.offset.mockResolvedValueOnce(rows);     // Q1 offset -> rows (terminal)

      // Query 2: ...where() -> [{total}]
      mock._chain.where.mockResolvedValueOnce([{ total }]);

      // loadScoresForEvaluations (only if rows non-empty)
      if (rows.length > 0) {
        mock._chain.where.mockResolvedValueOnce(scores);
      }

      // getBlindedTemplateIds (only if blinding path is taken)
      if (blindedTemplates !== undefined) {
        mock._chain.where.mockResolvedValueOnce(blindedTemplates);
      }
    }

    it('should return paginated results with default page/limit', async () => {
      const evaluation = buildEvaluation();
      const rows = [{ evaluation, evaluatorFirstName: 'John', evaluatorLastName: 'Doe' }];

      setupListQueries(rows, 1);

      const result = await service.listForEntity('interviews', 'interview-123');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('eval-1');
      expect(result.data[0].evaluator).toEqual({
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should return empty paginated response when no evaluations exist', async () => {
      setupListQueries([], 0);

      const result = await service.listForEntity('interviews', 'interview-123');

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should respect custom page and limit parameters', async () => {
      setupListQueries([], 30);

      const result = await service.listForEntity('interviews', 'interview-123', 2, 10);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(3);
    });

    it('should load scores for returned evaluations', async () => {
      const evaluation = buildEvaluation();
      const rows = [{ evaluation, evaluatorFirstName: 'John', evaluatorLastName: 'Doe' }];
      const scores = [
        buildScore({ evaluationId: 'eval-1', criteriaName: 'Problem Solving', score: 4 }),
        buildScore({ evaluationId: 'eval-1', criteriaName: 'Code Quality', score: 5, id: 's-2' }),
      ];

      setupListQueries(rows, 1, scores);

      const result = await service.listForEntity('interviews', 'interview-123');

      expect(result.data[0].scores).toHaveLength(2);
    });

    it('should NOT apply blinding when no currentUserId is provided', async () => {
      const evaluation = buildEvaluation({ evaluatorId: 'other-user' });
      const rows = [{ evaluation, evaluatorFirstName: 'Other', evaluatorLastName: 'User' }];

      setupListQueries(rows, 1);

      const result = await service.listForEntity('interviews', 'interview-123');

      expect(result.data[0].overallRating).toBe(4);
      expect(result.data[0].isBlinded).toBeUndefined();
    });

    it('should apply blinding when user has NOT submitted and template has blindingEnabled', async () => {
      const evaluation = buildEvaluation({ evaluatorId: 'other-user', templateId: 'tmpl-blinded' });
      const rows = [{ evaluation, evaluatorFirstName: 'Other', evaluatorLastName: 'User' }];

      setupListQueries(rows, 1, [], [
        { id: 'tmpl-blinded', blindingEnabled: true },
      ]);

      const result = await service.listForEntity('interviews', 'interview-123', 1, 25, 'current-user');

      expect(result.data[0].overallRating).toBe(0);
      expect(result.data[0].recommendation).toBeNull();
      expect(result.data[0].comment).toBeNull();
      expect(result.data[0].scores).toEqual([]);
      expect(result.data[0].isBlinded).toBe(true);
    });

    it('should NOT blind evaluations when user HAS already submitted', async () => {
      const currentUserEval = buildEvaluation({ id: 'eval-mine', evaluatorId: 'current-user' });
      const otherUserEval = buildEvaluation({ id: 'eval-other', evaluatorId: 'other-user' });
      const rows = [
        { evaluation: currentUserEval, evaluatorFirstName: 'Current', evaluatorLastName: 'User' },
        { evaluation: otherUserEval, evaluatorFirstName: 'Other', evaluatorLastName: 'User' },
      ];

      setupListQueries(rows, 2, [], [
        { id: 'tmpl-1', blindingEnabled: true },
      ]);

      const result = await service.listForEntity('interviews', 'interview-123', 1, 25, 'current-user');

      // User submitted, so even with blinding enabled, others are visible
      expect(result.data[1].overallRating).toBe(4);
      expect(result.data[1].isBlinded).toBeUndefined();
    });

    it('should not blind the current users own evaluation even when blinding is active', async () => {
      const currentUserEval = buildEvaluation({ id: 'eval-only', evaluatorId: 'current-user', templateId: 'tmpl-blinded' });
      const rows = [
        { evaluation: currentUserEval, evaluatorFirstName: 'Current', evaluatorLastName: 'User' },
      ];

      setupListQueries(rows, 1, [], [
        { id: 'tmpl-blinded', blindingEnabled: true },
      ]);

      const result = await service.listForEntity('interviews', 'interview-123', 1, 25, 'current-user');

      // User has submitted their own (it is in the list), so blinding is not applied
      expect(result.data[0].overallRating).toBe(4);
      expect(result.data[0].isBlinded).toBeUndefined();
    });

    it('should NOT blind when template does NOT have blindingEnabled', async () => {
      const evaluation = buildEvaluation({ evaluatorId: 'other-user' });
      const rows = [{ evaluation, evaluatorFirstName: 'Other', evaluatorLastName: 'User' }];

      setupListQueries(rows, 1, [], [
        { id: 'tmpl-1', blindingEnabled: false },
      ]);

      const result = await service.listForEntity('interviews', 'interview-123', 1, 25, 'current-user');

      expect(result.data[0].overallRating).toBe(4);
      expect(result.data[0].isBlinded).toBeUndefined();
    });

    it('should calculate totalPages correctly with partial last page', async () => {
      setupListQueries([], 11);

      const result = await service.listForEntity('interviews', 'interview-123', 1, 5);

      expect(result.meta.totalPages).toBe(3); // ceil(11/5) = 3
    });

    it('should include evaluator with null names', async () => {
      const evaluation = buildEvaluation({ evaluatorId: 'user-42' });
      const rows = [{ evaluation, evaluatorFirstName: null, evaluatorLastName: null }];

      setupListQueries(rows, 1);

      const result = await service.listForEntity('interviews', 'interview-123');

      expect(result.data[0].evaluator).toEqual({
        id: 'user-42',
        firstName: null,
        lastName: null,
      });
    });

    it('should group scores by evaluation id when multiple evaluations returned', async () => {
      const eval1 = buildEvaluation({ id: 'eval-1', evaluatorId: 'user-1' });
      const eval2 = buildEvaluation({ id: 'eval-2', evaluatorId: 'user-2' });
      const rows = [
        { evaluation: eval1, evaluatorFirstName: 'A', evaluatorLastName: 'A' },
        { evaluation: eval2, evaluatorFirstName: 'B', evaluatorLastName: 'B' },
      ];
      const scores = [
        buildScore({ evaluationId: 'eval-1', criteriaName: 'Problem Solving', score: 4, id: 's-1' }),
        buildScore({ evaluationId: 'eval-2', criteriaName: 'Code Quality', score: 3, id: 's-2' }),
      ];

      setupListQueries(rows, 2, scores);

      const result = await service.listForEntity('interviews', 'interview-123');

      expect(result.data[0].scores).toHaveLength(1);
      expect(result.data[0].scores[0].criteriaName).toBe('Problem Solving');
      expect(result.data[1].scores).toHaveLength(1);
      expect(result.data[1].scores[0].criteriaName).toBe('Code Quality');
    });
  });

  // -----------------------------------------------------------------------
  // getAverageRating
  // -----------------------------------------------------------------------
  //
  // Chain: select({avg}).from().where() — where is terminal

  describe('getAverageRating', () => {
    it('should return the average rating as a number', async () => {
      mock._chain.where.mockResolvedValueOnce([{ avg: '3.75' }]);

      const result = await service.getAverageRating('interviews', 'interview-123');

      expect(result).toBe(3.75);
    });

    it('should return null when no evaluations exist (avg is null)', async () => {
      mock._chain.where.mockResolvedValueOnce([{ avg: null }]);

      const result = await service.getAverageRating('interviews', 'interview-123');

      expect(result).toBeNull();
    });

    it('should return null when result row is undefined', async () => {
      mock._chain.where.mockResolvedValueOnce([]);

      const result = await service.getAverageRating('interviews', 'interview-123');

      expect(result).toBeNull();
    });

    it('should handle integer average values', async () => {
      mock._chain.where.mockResolvedValueOnce([{ avg: '4' }]);

      const result = await service.getAverageRating('interviews', 'interview-123');

      expect(result).toBe(4);
    });

    it('should handle high-precision average values', async () => {
      mock._chain.where.mockResolvedValueOnce([{ avg: '3.6666666666666667' }]);

      const result = await service.getAverageRating('interviews', 'interview-123');

      expect(result).toBeCloseTo(3.667, 2);
    });
  });

  // -----------------------------------------------------------------------
  // update (extended coverage)
  // -----------------------------------------------------------------------

  describe('update', () => {
    it('should successfully update overallRating and return updated evaluation', async () => {
      const existing = buildEvaluation({ evaluatorId: 'user-1', scores: [], template: buildTemplate() }) as any;
      const updated = buildEvaluation({ evaluatorId: 'user-1', overallRating: 5, scores: [], template: buildTemplate() }) as any;

      vi.spyOn(service, 'findByIdOrFail')
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const mockTx = buildMockTx();
      (mock.db as any).transaction = vi.fn().mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.update('eval-1', { overallRating: 5 }, 'user-1');

      expect(result.overallRating).toBe(5);
      expect(mockTx.update).toHaveBeenCalled();
    });

    it('should update comment field', async () => {
      const existing = buildEvaluation({ evaluatorId: 'user-1', scores: [], template: buildTemplate() }) as any;
      const updated = buildEvaluation({ evaluatorId: 'user-1', comment: 'Updated comment', scores: [], template: buildTemplate() }) as any;

      vi.spyOn(service, 'findByIdOrFail')
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const mockTx = buildMockTx();
      (mock.db as any).transaction = vi.fn().mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.update('eval-1', { comment: 'Updated comment' }, 'user-1');

      expect(result.comment).toBe('Updated comment');
    });

    it('should update recommendation field', async () => {
      const existing = buildEvaluation({ evaluatorId: 'user-1', recommendation: 'no', scores: [], template: buildTemplate() }) as any;
      const updated = buildEvaluation({ evaluatorId: 'user-1', recommendation: 'strong_yes', scores: [], template: buildTemplate() }) as any;

      vi.spyOn(service, 'findByIdOrFail')
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const mockTx = buildMockTx();
      (mock.db as any).transaction = vi.fn().mockImplementation(async (cb: any) => cb(mockTx));

      const result = await service.update('eval-1', { recommendation: 'strong_yes' }, 'user-1');

      expect(result.recommendation).toBe('strong_yes');
    });

    it('should replace scores when scores are provided', async () => {
      const existing = buildEvaluation({ evaluatorId: 'user-1', scores: [], template: buildTemplate() }) as any;
      const updated = buildEvaluation({ evaluatorId: 'user-1', scores: [], template: buildTemplate() }) as any;

      vi.spyOn(service, 'findByIdOrFail')
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const deleteMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const insertMock = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            buildScore({ criteriaName: 'Problem Solving', score: 5 }),
            buildScore({ criteriaName: 'Code Quality', score: 3 }),
          ]),
        }),
      });

      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        delete: deleteMock,
        insert: insertMock,
      };
      (mock.db as any).transaction = vi.fn().mockImplementation(async (cb: any) => cb(mockTx));

      await service.update('eval-1', {
        scores: [
          { criteriaName: 'Problem Solving', score: 5 },
          { criteriaName: 'Code Quality', score: 3 },
        ],
      }, 'user-1');

      expect(deleteMock).toHaveBeenCalled();
      expect(insertMock).toHaveBeenCalled();
    });

    it('should emit EVALUATIONS_EVALUATION_UPDATED event with before/after payload', async () => {
      const existing = buildEvaluation({
        evaluatorId: 'user-1',
        overallRating: 3,
        recommendation: 'no',
        comment: 'Needs improvement',
        scores: [],
        template: buildTemplate(),
      }) as any;
      const updated = buildEvaluation({
        evaluatorId: 'user-1',
        overallRating: 5,
        recommendation: 'strong_yes',
        comment: 'Excellent',
        scores: [],
        template: buildTemplate(),
      }) as any;

      vi.spyOn(service, 'findByIdOrFail')
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const mockTx = buildMockTx();
      (mock.db as any).transaction = vi.fn().mockImplementation(async (cb: any) => cb(mockTx));

      await service.update('eval-1', {
        overallRating: 5,
        recommendation: 'strong_yes',
        comment: 'Excellent',
      }, 'user-1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EVALUATIONS_EVALUATION_UPDATED,
        expect.objectContaining({
          entityType: 'evaluations',
          entityId: 'eval-1',
          actorId: 'user-1',
          payload: expect.objectContaining({
            before: { overallRating: 3, recommendation: 'no', comment: 'Needs improvement' },
            after: { overallRating: 5, recommendation: 'strong_yes', comment: 'Excellent' },
          }),
        }),
      );
    });

    it('should throw ForbiddenException when actor is not the evaluator', async () => {
      const existing = buildEvaluation({ evaluatorId: 'user-1', scores: [], template: buildTemplate() }) as any;
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(existing);

      await expect(service.update('eval-1', { overallRating: 5 }, 'other-user'))
        .rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when evaluation does not exist', async () => {
      vi.spyOn(service, 'findByIdOrFail').mockRejectedValueOnce(new NotFoundException('Evaluation not found'));

      await expect(service.update('nonexistent', { overallRating: 5 }, 'user-1'))
        .rejects.toThrow(NotFoundException);
    });

    it('should not call tx.update when no scalar fields are provided but scores are', async () => {
      const existing = buildEvaluation({ evaluatorId: 'user-1', scores: [], template: buildTemplate() }) as any;
      const updated = buildEvaluation({ evaluatorId: 'user-1', scores: [], template: buildTemplate() }) as any;

      vi.spyOn(service, 'findByIdOrFail')
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const updateMock = vi.fn();
      const mockTx = {
        update: updateMock,
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      (mock.db as any).transaction = vi.fn().mockImplementation(async (cb: any) => cb(mockTx));

      await service.update('eval-1', {
        scores: [
          { criteriaName: 'Problem Solving', score: 4 },
          { criteriaName: 'Code Quality', score: 5 },
        ],
      }, 'user-1');

      // tx.update should NOT be called since only scores were provided
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('should include targetEntityType and targetEntityId in update event payload', async () => {
      const existing = buildEvaluation({
        evaluatorId: 'user-1',
        entityType: 'interviews',
        entityId: 'interview-456',
        scores: [],
        template: buildTemplate(),
      }) as any;
      const updated = { ...existing, overallRating: 2 };

      vi.spyOn(service, 'findByIdOrFail')
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      const mockTx = buildMockTx();
      (mock.db as any).transaction = vi.fn().mockImplementation(async (cb: any) => cb(mockTx));

      await service.update('eval-1', { overallRating: 2 }, 'user-1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        EVALUATIONS_EVALUATION_UPDATED,
        expect.objectContaining({
          payload: expect.objectContaining({
            targetEntityType: 'interviews',
            targetEntityId: 'interview-456',
            evaluatorId: 'user-1',
            templateId: 'tmpl-1',
          }),
        }),
      );
    });

    it('should validate scores against template when scores are provided', async () => {
      const existing = buildEvaluation({ evaluatorId: 'user-1', scores: [], template: buildTemplate() }) as any;

      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(existing);

      await expect(service.update('eval-1', {
        scores: [
          { criteriaName: 'Problem Solving', score: 4 },
          // Missing Code Quality
        ],
      }, 'user-1')).rejects.toThrow('Missing score for criteria: Code Quality');
    });
  });

  // -----------------------------------------------------------------------
  // findByIdOrFail (via findById)
  // -----------------------------------------------------------------------

  describe('findByIdOrFail', () => {
    it('should return evaluation when found', async () => {
      const evaluation = buildEvaluation();
      const template = buildTemplate();

      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([evaluation]);
      mock._chain.where.mockResolvedValueOnce([]);
      mock._chain.where.mockReturnValueOnce(mock._chain);
      mock._chain.limit.mockResolvedValueOnce([template]);

      const result = await service.findByIdOrFail('eval-1');

      expect(result.id).toBe('eval-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mock._chain.limit.mockResolvedValueOnce([]);

      await expect(service.findByIdOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
