import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import { MultiValueService } from '@packages/entity-relations';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateInterviewDto, UpdateInterviewDto } from './interviews.dto';

const ENTITY_TYPE = 'interviews';

@Injectable()
export class InterviewsService {
  constructor(
    @Inject('ENTITY_SERVICE_interviews') private readonly entities: EntityService,
    private readonly database: DatabaseService,
    private readonly multiValue: MultiValueService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entities.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entities.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateInterviewDto, actorId: string) {
    const { interviewers, ...row } = input;

    return this.database.db.transaction(async (tx) => {
      const created = await this.entities.create(row, actorId, tx);

      if (interviewers?.length) {
        await this.multiValue.setValues(ENTITY_TYPE, created.id as string, 'interviewers', interviewers, tx);
      }

      return created;
    });
  }

  async update(
    id: string,
    input: UpdateInterviewDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    const { interviewers, ...row } = input;

    return this.database.db.transaction(async (tx) => {
      const updated = await this.entities.update(id, row, actorId, accessCtx, tx);

      if (interviewers !== undefined) {
        await this.multiValue.setValues(ENTITY_TYPE, id, 'interviewers', interviewers, tx);
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
