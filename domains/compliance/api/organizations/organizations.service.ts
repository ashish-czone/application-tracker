import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import { organizations } from './organizations.schema';
import type { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';

/**
 * Organizations is a singleton: exactly one row may exist and the row cannot
 * be deleted. Both invariants live here (not in engine hooks) because this
 * entity has been fanned out to a dedicated Controller + Service + Module and
 * the engine runs as a headless CRUD library.
 *
 * Create/update route through the engine (events + audit fire); delete is
 * hard-blocked — callers get a BadRequestException regardless of access
 * context.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @Inject('ENTITY_SERVICE_organizations') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateOrganizationDto, actorId: string) {
    const [{ count: rowCount }] = await this.database.db
      .select({ count: count() })
      .from(organizations);
    if (rowCount > 0) {
      throw new BadRequestException(
        'Organization is a singleton — only one row may exist. Update the existing one instead.',
      );
    }
    return this.entityService.create(input, actorId);
  }

  update(
    id: string,
    input: UpdateOrganizationDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    return this.entityService.update(id, input, actorId, accessCtx);
  }

  softDelete(_id: string, _actorId: string, _accessCtx?: DataAccessContext): Promise<never> {
    throw new BadRequestException('The organization record cannot be deleted.');
  }

  getListLayout() {
    return this.entityService.getListLayout();
  }
}
