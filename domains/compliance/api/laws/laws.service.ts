import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import { DatabaseService } from '@packages/database';
import { withTenant } from '@packages/tenancy/helpers';
import type { DataAccessContext } from '@packages/rbac';
import { complianceLaws } from '../schema/laws';
import type { CreateLawDto, UpdateLawDto } from './laws.dto';

export interface LawDisplayFields {
  id: string;
  code: string;
  name: string;
  jurisdiction: string | null;
}

@Injectable()
export class LawsService {
  constructor(
    @Inject('ENTITY_SERVICE_laws') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  /**
   * Batch-fetch display columns for a set of law IDs. Used by other compliance
   * services that surface law metadata (code, jurisdiction) alongside their
   * own list responses. Tenant-scoped via `withTenant`. Returns rows in
   * unspecified order — caller maps by id.
   */
  async findDisplayByIds(ids: readonly string[]): Promise<LawDisplayFields[]> {
    if (ids.length === 0) return [];
    return this.database.db
      .select({
        id: complianceLaws.id,
        code: complianceLaws.code,
        name: complianceLaws.name,
        jurisdiction: complianceLaws.jurisdiction,
      })
      .from(complianceLaws)
      .where(withTenant(complianceLaws, inArray(complianceLaws.id, ids as string[])));
  }

  create(input: CreateLawDto, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: UpdateLawDto, actorId: string, accessCtx?: DataAccessContext) {
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
