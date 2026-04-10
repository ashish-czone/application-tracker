import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService, eq, count } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { evaluationTemplates } from '../schema/evaluation-templates';
import { evaluations } from '../schema/evaluations';
import type { EvaluationTemplate, EvaluationTemplateCriteria } from '../types';

@Injectable()
export class EvaluationTemplatesService {
  constructor(private readonly database: DatabaseService) {}

  async create(data: {
    slug: string;
    name: string;
    entityType: string;
    criteria: EvaluationTemplateCriteria[];
    isActive?: boolean;
  }): Promise<EvaluationTemplate> {
    const [template] = await this.database.db
      .insert(evaluationTemplates)
      .values(withTenantInsert(evaluationTemplates, {
        slug: data.slug,
        name: data.name,
        entityType: data.entityType,
        criteria: data.criteria,
        isActive: data.isActive ?? true,
        updatedAt: new Date(),
      }))
      .returning();
    return template as EvaluationTemplate;
  }

  async update(id: string, data: {
    name?: string;
    criteria?: EvaluationTemplateCriteria[];
    isActive?: boolean;
  }): Promise<EvaluationTemplate> {
    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.criteria !== undefined) updateValues.criteria = data.criteria;
    if (data.isActive !== undefined) updateValues.isActive = data.isActive;

    if (Object.keys(updateValues).length === 0) {
      return this.findByIdOrFail(id);
    }

    const [updated] = await this.database.db
      .update(evaluationTemplates)
      .set(updateValues)
      .where(withTenant(evaluationTemplates, eq(evaluationTemplates.id, id)))
      .returning();

    if (!updated) throw new NotFoundException('Evaluation template not found');
    return updated as EvaluationTemplate;
  }

  async findById(id: string): Promise<EvaluationTemplate | null> {
    const [row] = await this.database.db
      .select()
      .from(evaluationTemplates)
      .where(withTenant(evaluationTemplates, eq(evaluationTemplates.id, id)))
      .limit(1);
    return (row as EvaluationTemplate) ?? null;
  }

  async findByIdOrFail(id: string): Promise<EvaluationTemplate> {
    const template = await this.findById(id);
    if (!template) throw new NotFoundException('Evaluation template not found');
    return template;
  }

  async findBySlug(slug: string): Promise<EvaluationTemplate | null> {
    const [row] = await this.database.db
      .select()
      .from(evaluationTemplates)
      .where(withTenant(evaluationTemplates, eq(evaluationTemplates.slug, slug)))
      .limit(1);
    return (row as EvaluationTemplate) ?? null;
  }

  async list(query: {
    entityType?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<EvaluationTemplate>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions: Parameters<typeof withTenant>[1][] = [];
    if (query.entityType !== undefined) {
      conditions.push(eq(evaluationTemplates.entityType, query.entityType));
    }
    if (query.isActive !== undefined) {
      conditions.push(eq(evaluationTemplates.isActive, query.isActive));
    }

    const [rows, [{ total }]] = await Promise.all([
      this.database.db
        .select()
        .from(evaluationTemplates)
        .where(withTenant(evaluationTemplates, ...conditions))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(evaluationTemplates)
        .where(withTenant(evaluationTemplates, ...conditions)),
    ]);

    return {
      data: rows as EvaluationTemplate[],
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async delete(id: string): Promise<void> {
    const template = await this.findByIdOrFail(id);

    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(evaluations)
      .where(withTenant(evaluations, eq(evaluations.templateId, template.id)));

    if (Number(total) > 0) {
      throw new ConflictException('Cannot delete template with existing evaluations. Deactivate it instead.');
    }

    await this.database.db
      .delete(evaluationTemplates)
      .where(withTenant(evaluationTemplates, eq(evaluationTemplates.id, id)));
  }

  async ensureTemplate(data: {
    slug: string;
    name: string;
    entityType: string;
    criteria: EvaluationTemplateCriteria[];
  }): Promise<EvaluationTemplate> {
    const existing = await this.findBySlug(data.slug);
    if (existing) return existing;
    return this.create(data);
  }
}
