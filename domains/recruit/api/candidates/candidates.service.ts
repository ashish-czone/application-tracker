import { Inject, Injectable } from '@nestjs/common';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateCandidateDto, UpdateCandidateDto } from './candidates.dto';

@Injectable()
export class CandidatesService {
  constructor(
    @Inject('ENTITY_SERVICE_candidates') private readonly entityService: EntityService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(mapCandidatesQuery(query), accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  create(input: CreateCandidateDto, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: UpdateCandidateDto, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.update(id, input, actorId, accessCtx);
  }

  softDelete(id: string, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.softDelete(id, actorId, accessCtx);
  }

  clone(id: string, actorId: string) {
    return this.entityService.clone(id, actorId);
  }

  restore(id: string) {
    return this.entityService.restore(id);
  }

  getListLayout() {
    return this.entityService.getListLayout();
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
