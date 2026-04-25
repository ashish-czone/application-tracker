import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { TaxonomyService } from '@packages/taxonomy';
import type { CreateCandidateDto, UpdateCandidateDto } from './candidates.dto';

const ENTITY_TYPE = 'candidates';
const SKILLS_TAG_GROUP_SLUG = 'recruit-skills';

@Injectable()
export class CandidatesService {
  constructor(
    @Inject('ENTITY_SERVICE_candidates') private readonly entities: EntityService,
    private readonly database: DatabaseService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entities.list(mapCandidatesQuery(query), accessCtx);
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
