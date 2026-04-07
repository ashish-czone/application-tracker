import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DatabaseService, eq, count, desc, avg, inArray } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import type { PaginatedResponse } from '@packages/common';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { evaluations } from '../schema/evaluations';
import { evaluationScores } from '../schema/evaluation-scores';
import { evaluationTemplates } from '../schema/evaluation-templates';
import { EvaluationTemplatesService } from './evaluation-templates.service';
import {
  EVALUATIONS_EVALUATION_SUBMITTED,
  EVALUATIONS_EVALUATION_UPDATED,
  EVALUATIONS_EVALUATION_DELETED,
} from '../events/types';
import type { EvaluationWithScores, EvaluationScore, EvaluationTemplate } from '../types';

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly domainEventEmitter: DomainEventEmitter,
    private readonly templatesService: EvaluationTemplatesService,
  ) {}

  async create(data: {
    templateId: string;
    entityType: string;
    entityId: string;
    evaluatorId: string;
    overallRating: number;
    comment?: string;
    scores: { criteriaName: string; score: number; note?: string }[];
  }): Promise<EvaluationWithScores> {
    const template = await this.templatesService.findByIdOrFail(data.templateId);
    this.validateScores(data.scores, template);

    const result = await this.database.db.transaction(async (tx) => {
      const [evaluation] = await tx
        .insert(evaluations)
        .values(withTenantInsert(evaluations, {
          templateId: data.templateId,
          entityType: data.entityType,
          entityId: data.entityId,
          evaluatorId: data.evaluatorId,
          overallRating: data.overallRating,
          comment: data.comment ?? null,
          submittedAt: new Date(),
          updatedAt: new Date(),
        }))
        .returning();

      const scoreRows = await tx
        .insert(evaluationScores)
        .values(data.scores.map((s) => ({
          evaluationId: evaluation.id,
          criteriaName: s.criteriaName,
          score: s.score,
          note: s.note ?? null,
        })))
        .returning();

      return { evaluation, scores: scoreRows };
    });

    this.domainEventEmitter.emit(EVALUATIONS_EVALUATION_SUBMITTED, {
      entityType: 'evaluations',
      entityId: result.evaluation.id,
      actorId: data.evaluatorId,
      payload: {
        targetEntityType: data.entityType,
        targetEntityId: data.entityId,
        evaluatorId: data.evaluatorId,
        templateId: data.templateId,
        templateSlug: template.slug,
        overallRating: data.overallRating,
        scores: data.scores.map((s) => ({ criteriaName: s.criteriaName, score: s.score })),
      },
    });

    return {
      ...result.evaluation,
      scores: result.scores as EvaluationScore[],
      template,
    };
  }

  async update(id: string, data: {
    overallRating?: number;
    comment?: string;
    scores?: { criteriaName: string; score: number; note?: string }[];
  }, actorId: string): Promise<EvaluationWithScores> {
    const existing = await this.findByIdOrFail(id);

    if (existing.evaluatorId !== actorId) {
      throw new ForbiddenException('Only the evaluator can update this evaluation');
    }

    if (data.scores) {
      const template = await this.templatesService.findByIdOrFail(existing.templateId);
      this.validateScores(data.scores, template);
    }

    const before = { overallRating: existing.overallRating, comment: existing.comment };

    await this.database.db.transaction(async (tx) => {
      const updateValues: Record<string, unknown> = {};
      if (data.overallRating !== undefined) updateValues.overallRating = data.overallRating;
      if (data.comment !== undefined) updateValues.comment = data.comment;

      if (Object.keys(updateValues).length > 0) {
        await tx
          .update(evaluations)
          .set(updateValues)
          .where(withTenant(evaluations, eq(evaluations.id, id)));
      }

      if (data.scores) {
        await tx
          .delete(evaluationScores)
          .where(eq(evaluationScores.evaluationId, id));

        await tx
          .insert(evaluationScores)
          .values(data.scores.map((s) => ({
            evaluationId: id,
            criteriaName: s.criteriaName,
            score: s.score,
            note: s.note ?? null,
          })))
          .returning();
      }
    });

    const updated = await this.findByIdOrFail(id);

    this.domainEventEmitter.emit(EVALUATIONS_EVALUATION_UPDATED, {
      entityType: 'evaluations',
      entityId: id,
      actorId,
      payload: {
        targetEntityType: updated.entityType,
        targetEntityId: updated.entityId,
        evaluatorId: updated.evaluatorId,
        templateId: updated.templateId,
        before,
        after: { overallRating: updated.overallRating, comment: updated.comment },
      },
    });

    return updated;
  }

  async delete(id: string, actorId: string): Promise<void> {
    const existing = await this.findByIdOrFail(id);

    if (existing.evaluatorId !== actorId) {
      throw new ForbiddenException('Only the evaluator can delete this evaluation');
    }

    await this.database.db
      .delete(evaluations)
      .where(withTenant(evaluations, eq(evaluations.id, id)));

    this.domainEventEmitter.emit(EVALUATIONS_EVALUATION_DELETED, {
      entityType: 'evaluations',
      entityId: id,
      actorId,
      payload: {
        targetEntityType: existing.entityType,
        targetEntityId: existing.entityId,
        evaluatorId: existing.evaluatorId,
        templateId: existing.templateId,
      },
    });
  }

  async findById(id: string): Promise<EvaluationWithScores | null> {
    const [row] = await this.database.db
      .select()
      .from(evaluations)
      .where(withTenant(evaluations, eq(evaluations.id, id)))
      .limit(1);

    if (!row) return null;

    const scores = await this.database.db
      .select()
      .from(evaluationScores)
      .where(eq(evaluationScores.evaluationId, id));

    const [template] = await this.database.db
      .select()
      .from(evaluationTemplates)
      .where(withTenant(evaluationTemplates, eq(evaluationTemplates.id, row.templateId)))
      .limit(1);

    return {
      ...row,
      scores: scores as EvaluationScore[],
      template: (template as EvaluationTemplate) ?? undefined,
    };
  }

  async findByIdOrFail(id: string): Promise<EvaluationWithScores> {
    const evaluation = await this.findById(id);
    if (!evaluation) throw new NotFoundException('Evaluation not found');
    return evaluation;
  }

  async listForEntity(
    entityType: string,
    entityId: string,
    page = 1,
    limit = 25,
  ): Promise<PaginatedResponse<EvaluationWithScores>> {
    const offset = (page - 1) * limit;

    const [rows, [{ total }]] = await Promise.all([
      this.database.db
        .select()
        .from(evaluations)
        .where(withTenant(evaluations,
          eq(evaluations.entityType, entityType),
          eq(evaluations.entityId, entityId),
        ))
        .orderBy(desc(evaluations.createdAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(evaluations)
        .where(withTenant(evaluations,
          eq(evaluations.entityType, entityType),
          eq(evaluations.entityId, entityId),
        )),
    ]);

    const evaluationIds = rows.map((r) => r.id);
    const allScores = evaluationIds.length > 0
      ? await this.loadScoresForEvaluations(evaluationIds)
      : new Map<string, EvaluationScore[]>();

    return {
      data: rows.map((row) => ({
        ...row,
        scores: allScores.get(row.id) ?? [],
      })) as EvaluationWithScores[],
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async getAverageRating(entityType: string, entityId: string): Promise<number | null> {
    const [result] = await this.database.db
      .select({ avg: avg(evaluations.overallRating) })
      .from(evaluations)
      .where(withTenant(evaluations,
        eq(evaluations.entityType, entityType),
        eq(evaluations.entityId, entityId),
      ));

    return result?.avg ? Number(result.avg) : null;
  }

  private validateScores(
    scores: { criteriaName: string; score: number }[],
    template: { criteria: { name: string }[] },
  ): void {
    const templateCriteriaNames = new Set(template.criteria.map((c) => c.name));
    const providedNames = new Set(scores.map((s) => s.criteriaName));

    for (const name of templateCriteriaNames) {
      if (!providedNames.has(name)) {
        throw new BadRequestException(`Missing score for criteria: ${name}`);
      }
    }

    for (const score of scores) {
      if (!templateCriteriaNames.has(score.criteriaName)) {
        throw new BadRequestException(`Unknown criteria: ${score.criteriaName}`);
      }
      if (score.score < 1 || score.score > 5 || !Number.isInteger(score.score)) {
        throw new BadRequestException(`Score must be an integer between 1 and 5 for criteria: ${score.criteriaName}`);
      }
    }
  }

  private async loadScoresForEvaluations(evaluationIds: string[]): Promise<Map<string, EvaluationScore[]>> {
    const scores = await this.database.db
      .select()
      .from(evaluationScores)
      .where(inArray(evaluationScores.evaluationId, evaluationIds));

    const map = new Map<string, EvaluationScore[]>();
    for (const score of scores) {
      const list = map.get(score.evaluationId) ?? [];
      list.push(score as EvaluationScore);
      map.set(score.evaluationId, list);
    }
    return map;
  }
}
