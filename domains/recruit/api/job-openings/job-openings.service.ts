import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import { MultiValueService } from '@packages/entity-relations';
import { TaxonomyService } from '@packages/taxonomy';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateJobOpeningDto, UpdateJobOpeningDto } from './job-openings.dto';

const ENTITY_TYPE = 'job_openings';
const REQUIRED_SKILLS_TAG_GROUP_SLUG = 'recruit-skills';

@Injectable()
export class JobOpeningsService {
  constructor(
    @Inject('ENTITY_SERVICE_job_openings') private readonly entities: EntityService,
    private readonly database: DatabaseService,
    private readonly multiValue: MultiValueService,
    private readonly taxonomy: TaxonomyService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entities.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entities.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateJobOpeningDto, actorId: string) {
    const { requiredSkills, assignedRecruiters, ...row } = input;

    return this.database.db.transaction(async (tx) => {
      const created = await this.entities.create(row, actorId, tx);

      if (requiredSkills?.length) {
        await this.taxonomy.setTagsForEntityInGroup(
          ENTITY_TYPE, created.id as string, REQUIRED_SKILLS_TAG_GROUP_SLUG, requiredSkills, tx,
        );
      }
      if (assignedRecruiters?.length) {
        await this.multiValue.setValues(ENTITY_TYPE, created.id as string, 'assignedRecruiters', assignedRecruiters, tx);
      }

      return created;
    });
  }

  async update(
    id: string,
    input: UpdateJobOpeningDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    const { requiredSkills, assignedRecruiters, ...row } = input;

    return this.database.db.transaction(async (tx) => {
      const updated = await this.entities.update(id, row, actorId, accessCtx, tx);

      if (requiredSkills !== undefined) {
        await this.taxonomy.setTagsForEntityInGroup(
          ENTITY_TYPE, id, REQUIRED_SKILLS_TAG_GROUP_SLUG, requiredSkills, tx,
        );
      }
      if (assignedRecruiters !== undefined) {
        await this.multiValue.setValues(ENTITY_TYPE, id, 'assignedRecruiters', assignedRecruiters, tx);
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
