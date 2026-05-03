import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DatabaseService, withScope } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import type { PaginatedResponse } from '@packages/common';
import { TaxonomyService } from '@packages/taxonomy';
import { applications } from '../applications/schema/applications';
import type { CreateCandidateDto, UpdateCandidateDto } from './candidates.dto';

const ENTITY_TYPE = 'candidates';
const SKILLS_TAG_GROUP_SLUG = 'recruit-skills';

interface ListQuery extends BaseListQuery {
  /** When set, each row is annotated with `__existingApplicationId` for the given job opening. */
  annotateApplicationsFor?: string;
}

@Injectable()
export class CandidatesService {
  constructor(
    @Inject('ENTITY_SERVICE_candidates') private readonly entities: EntityService,
    private readonly database: DatabaseService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  async list(
    query: ListQuery,
    accessCtx?: DataAccessContext,
  ): Promise<PaginatedResponse<Record<string, unknown>>> {
    const { annotateApplicationsFor, ...rest } = query;
    const result = await this.entities.list(mapCandidatesQuery(rest), accessCtx);

    if (!annotateApplicationsFor || result.data.length === 0) {
      return result;
    }

    const ids = result.data.map((row) => row.id as string);
    const rows = await this.database.db
      .select({ candidateId: applications.candidateId, applicationId: applications.id })
      .from(applications)
      .where(
        withScope(
          applications,
          and(
            eq(applications.jobOpeningId, annotateApplicationsFor),
            inArray(applications.candidateId, ids),
          ),
        ),
      );
    const existing = new Map(rows.map((r) => [r.candidateId, r.applicationId]));

    return {
      ...result,
      data: result.data.map((row) => ({
        ...row,
        __existingApplicationId: existing.get(row.id as string) ?? null,
      })),
    };
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entities.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateCandidateDto, actorId: string) {
    const { skills, ...row } = input;

    return this.database.db.transaction(async (tx) => {
      const created = await this.entities.create(row, actorId, tx);

      if (skills?.length) {
        await this.taxonomy.setTagsForEntityInGroup(
          ENTITY_TYPE,
          created.id as string,
          SKILLS_TAG_GROUP_SLUG,
          skills,
          tx,
        );
      }

      return created;
    });
  }

  async update(
    id: string,
    input: UpdateCandidateDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    const { skills, ...row } = input;

    return this.database.db.transaction(async (tx) => {
      const updated = await this.entities.update(id, row, actorId, accessCtx, tx);

      if (skills !== undefined) {
        await this.taxonomy.setTagsForEntityInGroup(
          ENTITY_TYPE,
          id,
          SKILLS_TAG_GROUP_SLUG,
          skills,
          tx,
        );
      }

      return updated;
    });
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.entities.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    return this.entities.clone(id, actorId);
  }

  restore(id: string) {
    return this.entities.restore(id);
  }

  getListLayout() {
    return this.entities.getListLayout();
  }
}

type StructuredFilter = { field: string; operator: string; value: unknown };

function mapCandidatesQuery(query: BaseListQuery): BaseListQuery {
  const { qualification, ...rest } = query as BaseListQuery & { qualification?: unknown };
  if (qualification == null || qualification === '') return query;

  const existing: StructuredFilter[] = rest.filters ? JSON.parse(rest.filters as string) : [];
  existing.push({ field: 'highestQualification', operator: 'eq', value: qualification });
  return { ...rest, filters: JSON.stringify(existing) };
}
