import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { createPlatformTestModule, cleanDatabase } from '@packages/platform-testing';
import { users } from '@packages/database/schema';
import { AuditModule } from '@packages/audit';
import { EvaluationsModule } from '../../evaluations.module';
import { EvaluationsService } from '../evaluations.service';
import { EvaluationTemplatesService } from '../evaluation-templates.service';
import type { DrizzleDB } from '@packages/database';
import type { TestingModule } from '@nestjs/testing';
import type { EvaluationTemplate } from '../../types';

describe('Evaluations (integration)', () => {
  let module: TestingModule;
  let db: DrizzleDB;
  let cleanup: () => Promise<void>;
  let evaluationsService: EvaluationsService;
  let templatesService: EvaluationTemplatesService;

  let evaluatorId: string;
  let otherUserId: string;
  let template: EvaluationTemplate;

  beforeAll(async () => {
    const ctx = await createPlatformTestModule({
      imports: [AuditModule, EvaluationsModule],
    });
    module = ctx.module;
    db = ctx.db;
    cleanup = ctx.cleanup;
    evaluationsService = module.get(EvaluationsService);
    templatesService = module.get(EvaluationTemplatesService);
  });

  afterEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await cleanup();
  });

  async function createUser(firstName = 'Test'): Promise<string> {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: `user-${id.slice(0, 8)}@test.com`,
      firstName,
      lastName: 'User',
      userType: 'internal',
    });
    return id;
  }

  async function seedBasicData() {
    evaluatorId = await createUser('Evaluator');
    otherUserId = await createUser('Other');
    template = await templatesService.create({
      slug: `test-template-${randomUUID().slice(0, 8)}`,
      name: 'Interview Evaluation',
      entityType: 'candidates',
      criteria: [
        { name: 'Technical', description: 'Technical skills' },
        { name: 'Communication', description: 'Communication ability' },
      ],
    });
  }

  function makeScores() {
    return [
      { criteriaName: 'Technical', score: 4 },
      { criteriaName: 'Communication', score: 3 },
    ];
  }

  // ---------- EvaluationTemplatesService ----------

  describe('EvaluationTemplatesService', () => {
    describe('create', () => {
      it('should create a template with criteria', async () => {
        const t = await templatesService.create({
          slug: 'interview-eval',
          name: 'Interview',
          entityType: 'candidates',
          criteria: [{ name: 'Technical', description: 'Skills' }],
        });

        expect(t.id).toBeDefined();
        expect(t.slug).toBe('interview-eval');
        expect(t.criteria).toHaveLength(1);
        expect(t.isActive).toBe(true);
      });
    });

    describe('findBySlug', () => {
      it('should find by slug', async () => {
        await templatesService.create({
          slug: 'find-me',
          name: 'Find Me',
          entityType: 'candidates',
          criteria: [{ name: 'Skill', description: 'X' }],
        });

        const found = await templatesService.findBySlug('find-me');
        expect(found).not.toBeNull();
        expect(found!.name).toBe('Find Me');
      });

      it('should return null for non-existent slug', async () => {
        const found = await templatesService.findBySlug('nope');
        expect(found).toBeNull();
      });
    });

    describe('list', () => {
      it('should list templates with pagination', async () => {
        for (let i = 0; i < 3; i++) {
          await templatesService.create({
            slug: `tmpl-${i}`,
            name: `Template ${i}`,
            entityType: 'candidates',
            criteria: [{ name: 'C', description: 'D' }],
          });
        }

        const result = await templatesService.list({ page: 1, limit: 2 });
        expect(result.data).toHaveLength(2);
        expect(result.meta.total).toBe(3);
        expect(result.meta.totalPages).toBe(2);
      });

      it('should filter by entityType', async () => {
        await templatesService.create({ slug: 'c1', name: 'C', entityType: 'candidates', criteria: [] });
        await templatesService.create({ slug: 'o1', name: 'O', entityType: 'orders', criteria: [] });

        const result = await templatesService.list({ entityType: 'candidates' });
        expect(result.data).toHaveLength(1);
        expect(result.data[0].entityType).toBe('candidates');
      });

      it('should filter by isActive', async () => {
        await templatesService.create({ slug: 'active', name: 'Active', entityType: 'candidates', criteria: [], isActive: true });
        await templatesService.create({ slug: 'inactive', name: 'Inactive', entityType: 'candidates', criteria: [], isActive: false });

        const result = await templatesService.list({ isActive: true });
        expect(result.data).toHaveLength(1);
        expect(result.data[0].slug).toBe('active');
      });
    });

    describe('update', () => {
      it('should update template fields', async () => {
        const t = await templatesService.create({
          slug: 'update-me',
          name: 'Original',
          entityType: 'candidates',
          criteria: [{ name: 'A', description: 'B' }],
        });

        const updated = await templatesService.update(t.id, {
          name: 'Updated',
          isActive: false,
        });

        expect(updated.name).toBe('Updated');
        expect(updated.isActive).toBe(false);
      });
    });

    describe('delete', () => {
      it('should delete template with no evaluations', async () => {
        const t = await templatesService.create({
          slug: 'delete-me',
          name: 'Delete',
          entityType: 'candidates',
          criteria: [],
        });

        await templatesService.delete(t.id);
        const found = await templatesService.findById(t.id);
        expect(found).toBeNull();
      });

      it('should throw ConflictException when template has evaluations', async () => {
        await seedBasicData();

        await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 4,
          recommendation: 'hire',
          scores: makeScores(),
        });

        await expect(templatesService.delete(template.id))
          .rejects.toThrow('Cannot delete template with existing evaluations');
      });
    });

    describe('ensureTemplate', () => {
      it('should create if not exists', async () => {
        const t = await templatesService.ensureTemplate({
          slug: 'ensure-new',
          name: 'Ensure',
          entityType: 'candidates',
          criteria: [{ name: 'X', description: 'Y' }],
        });

        expect(t.slug).toBe('ensure-new');
      });

      it('should return existing if slug matches', async () => {
        const first = await templatesService.create({
          slug: 'ensure-existing',
          name: 'First',
          entityType: 'candidates',
          criteria: [],
        });

        const second = await templatesService.ensureTemplate({
          slug: 'ensure-existing',
          name: 'Second',
          entityType: 'candidates',
          criteria: [],
        });

        expect(second.id).toBe(first.id);
        expect(second.name).toBe('First');
      });
    });
  });

  // ---------- EvaluationsService ----------

  describe('EvaluationsService', () => {
    describe('create', () => {
      it('should create evaluation with scores transactionally', async () => {
        await seedBasicData();
        const entityId = randomUUID();

        const result = await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId,
          evaluatorId,
          overallRating: 4,
          recommendation: 'hire',
          comment: 'Great candidate',
          scores: makeScores(),
        });

        expect(result.id).toBeDefined();
        expect(result.overallRating).toBe(4);
        expect(result.recommendation).toBe('hire');
        expect(result.comment).toBe('Great candidate');
        expect(result.scores).toHaveLength(2);
        expect(result.template.id).toBe(template.id);
      });

      it('should validate scores match template criteria', async () => {
        await seedBasicData();

        await expect(evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 4,
          recommendation: 'hire',
          scores: [{ criteriaName: 'Technical', score: 4 }], // Missing Communication
        })).rejects.toThrow('Missing score for criteria: Communication');
      });

      it('should reject unknown criteria', async () => {
        await seedBasicData();

        await expect(evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 4,
          recommendation: 'hire',
          scores: [
            ...makeScores(),
            { criteriaName: 'Unknown', score: 3 },
          ],
        })).rejects.toThrow('Unknown criteria: Unknown');
      });

      it('should reject scores outside 1-5 range', async () => {
        await seedBasicData();

        await expect(evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 4,
          recommendation: 'hire',
          scores: [
            { criteriaName: 'Technical', score: 0 },
            { criteriaName: 'Communication', score: 3 },
          ],
        })).rejects.toThrow('Score must be an integer between 1 and 5');
      });
    });

    describe('findById', () => {
      it('should return evaluation with scores and template', async () => {
        await seedBasicData();

        const created = await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 3,
          recommendation: 'maybe',
          scores: makeScores(),
        });

        const found = await evaluationsService.findById(created.id);
        expect(found).not.toBeNull();
        expect(found!.scores).toHaveLength(2);
        expect(found!.template.id).toBe(template.id);
      });

      it('should return null for non-existent ID', async () => {
        const found = await evaluationsService.findById(randomUUID());
        expect(found).toBeNull();
      });
    });

    describe('update', () => {
      it('should update evaluation fields', async () => {
        await seedBasicData();

        const created = await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 3,
          recommendation: 'maybe',
          scores: makeScores(),
        });

        const updated = await evaluationsService.update(
          created.id,
          { overallRating: 5, comment: 'Revised' },
          evaluatorId,
        );

        expect(updated.overallRating).toBe(5);
        expect(updated.comment).toBe('Revised');
      });

      it('should replace scores when provided', async () => {
        await seedBasicData();

        const created = await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 3,
          recommendation: 'maybe',
          scores: makeScores(),
        });

        const updated = await evaluationsService.update(
          created.id,
          {
            scores: [
              { criteriaName: 'Technical', score: 5, note: 'Excellent' },
              { criteriaName: 'Communication', score: 5 },
            ],
          },
          evaluatorId,
        );

        expect(updated.scores).toHaveLength(2);
        const techScore = updated.scores.find((s) => s.criteriaName === 'Technical');
        expect(techScore!.score).toBe(5);
        expect(techScore!.note).toBe('Excellent');
      });

      it('should throw ForbiddenException when non-evaluator tries to update', async () => {
        await seedBasicData();

        const created = await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 3,
          recommendation: 'maybe',
          scores: makeScores(),
        });

        await expect(
          evaluationsService.update(created.id, { overallRating: 1 }, otherUserId),
        ).rejects.toThrow('Only the evaluator can update');
      });
    });

    describe('delete', () => {
      it('should delete evaluation and cascade scores', async () => {
        await seedBasicData();

        const created = await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 3,
          recommendation: 'maybe',
          scores: makeScores(),
        });

        await evaluationsService.delete(created.id, evaluatorId);

        const found = await evaluationsService.findById(created.id);
        expect(found).toBeNull();
      });

      it('should throw ForbiddenException when non-evaluator tries to delete', async () => {
        await seedBasicData();

        const created = await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: randomUUID(),
          evaluatorId,
          overallRating: 3,
          recommendation: 'maybe',
          scores: makeScores(),
        });

        await expect(
          evaluationsService.delete(created.id, otherUserId),
        ).rejects.toThrow('Only the evaluator can delete');
      });
    });

    describe('listForEntity', () => {
      it('should return paginated evaluations for entity', async () => {
        await seedBasicData();
        const entityId = randomUUID();

        for (let i = 0; i < 3; i++) {
          await evaluationsService.create({
            templateId: template.id,
            entityType: 'candidates',
            entityId,
            evaluatorId: await createUser(`Eval${i}`),
            overallRating: 3 + i,
            recommendation: 'hire',
            scores: makeScores(),
          });
        }

        const result = await evaluationsService.listForEntity('candidates', entityId, 1, 10);
        expect(result.data).toHaveLength(3);
        expect(result.meta.total).toBe(3);
        // Each should have scores loaded
        for (const eval_ of result.data) {
          expect(eval_.scores).toHaveLength(2);
        }
      });

      it('should not return evaluations from other entities', async () => {
        await seedBasicData();
        const e1 = randomUUID();
        const e2 = randomUUID();

        await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: e1,
          evaluatorId,
          overallRating: 3,
          recommendation: 'hire',
          scores: makeScores(),
        });
        await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId: e2,
          evaluatorId: await createUser('Eval2'),
          overallRating: 4,
          recommendation: 'hire',
          scores: makeScores(),
        });

        const result = await evaluationsService.listForEntity('candidates', e1);
        expect(result.data).toHaveLength(1);
      });
    });

    describe('getAverageRating', () => {
      it('should compute average rating for entity', async () => {
        await seedBasicData();
        const entityId = randomUUID();

        await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId,
          evaluatorId,
          overallRating: 3,
          recommendation: 'hire',
          scores: makeScores(),
        });
        await evaluationsService.create({
          templateId: template.id,
          entityType: 'candidates',
          entityId,
          evaluatorId: await createUser('Eval2'),
          overallRating: 5,
          recommendation: 'hire',
          scores: makeScores(),
        });

        const avg = await evaluationsService.getAverageRating('candidates', entityId);
        expect(avg).toBe(4); // (3 + 5) / 2
      });

      it('should return null when no evaluations exist', async () => {
        const avg = await evaluationsService.getAverageRating('candidates', randomUUID());
        expect(avg).toBeNull();
      });
    });
  });
});
