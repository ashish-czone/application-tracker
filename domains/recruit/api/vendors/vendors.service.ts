import { Inject, Injectable } from '@nestjs/common';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateVendorDto, UpdateVendorDto } from './vendors.dto';

/**
 * Vendors domain service.
 *
 * Delegates mechanical CRUD to the engine's `EntityService` (kept as a
 * library — it still handles validation, storage, event emission, audit).
 * Domain-specific behaviour would live here as additional methods. Today
 * vendors has no domain verbs beyond CRUD.
 */
@Injectable()
export class VendorsService {
  constructor(
    @Inject('ENTITY_SERVICE_vendors') private readonly entityService: EntityService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  create(input: CreateVendorDto, actorId: string) {
    return this.entityService.create(input, actorId);
  }

  update(id: string, input: UpdateVendorDto, actorId: string, accessCtx?: DataAccessContext) {
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
