import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { count } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { BaseCrudService } from '@packages/crud-base';
import type { DataAccessContext } from '@packages/rbac';
import { organizations } from './organizations.schema';
import { ORGANIZATIONS_CRUD_TOKEN } from './organizations.crud-token';
import type { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';

/**
 * Organizations is a singleton: exactly one row may exist and the row cannot
 * be deleted. Both invariants live here as explicit method bodies.
 *
 * Composition with `BaseCrudService` (no inheritance) — `crud` is injected
 * under a per-entity DI token wired in `organizations.module.ts` via
 * `createCrudProvider`. The standard list/findOne/update flows are thin
 * delegate methods; create/softDelete carry the singleton logic.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(ORGANIZATIONS_CRUD_TOKEN)
    private readonly crud: BaseCrudService<typeof organizations>,
    private readonly database: DatabaseService,
  ) {}

  list(query: Parameters<BaseCrudService<typeof organizations>['list']>[0] = {}, accessCtx?: DataAccessContext) {
    return this.crud.list(query, accessCtx);
  }

  findOneOrFail(id: string, accessCtx?: DataAccessContext) {
    return this.crud.findOneOrFail(id, accessCtx);
  }

  /**
   * Singleton invariant: reject create when any row already exists. The
   * caller-facing message points them at update so the API remains
   * discoverable from the error.
   */
  async create(input: CreateOrganizationDto, actorId: string) {
    const [{ count: rowCount }] = await this.database.db
      .select({ count: count() })
      .from(organizations);
    if (rowCount > 0) {
      throw new BadRequestException(
        'Organization is a singleton — only one row may exist. Update the existing one instead.',
      );
    }
    return this.crud.create(input as never, actorId);
  }

  update(
    id: string,
    input: UpdateOrganizationDto,
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    return this.crud.update(id, input as never, actorId, accessCtx);
  }

  /**
   * Hard-block delete — organizations is a singleton; the row represents
   * the deployment's identity and cannot be removed. Throw regardless of
   * id or access context so the failure is unambiguous.
   */
  async softDelete(_id: string, _actorId: string, _accessCtx?: DataAccessContext): Promise<never> {
    throw new BadRequestException('The organization record cannot be deleted.');
  }
}
