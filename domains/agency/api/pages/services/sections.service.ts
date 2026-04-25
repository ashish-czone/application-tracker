import { Inject, Injectable } from '@nestjs/common';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateSectionDto, UpdateSectionDto } from '../dto/sections.dto';

@Injectable()
export class SectionsService {
  constructor(
    @Inject('ENTITY_SERVICE_sections') private readonly entityService: EntityService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  create(input: CreateSectionDto, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: UpdateSectionDto, actorId: string, accessCtx?: DataAccessContext) {
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
