import { Inject, Injectable } from '@nestjs/common';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateServiceDto, UpdateServiceDto } from '../dto/services.dto';

@Injectable()
export class ServicesService {
  constructor(@Inject('ENTITY_SERVICE_services') private readonly entityService: EntityService) {}
  list(q: BaseListQuery, c?: DataAccessContext) { return this.entityService.list(q, c); }
  findOne(id: string, c?: DataAccessContext) { return this.entityService.findOneOrFail(id, c); }
  create(i: CreateServiceDto, a: string) { return this.entityService.create(i, a); }
  update(id: string, i: UpdateServiceDto, a: string, c?: DataAccessContext) { return this.entityService.update(id, i, a, c); }
  softDelete(id: string, a: string, c?: DataAccessContext) { return this.entityService.softDelete(id, a, c); }
  clone(id: string, a: string) { return this.entityService.clone(id, a); }
  restore(id: string) { return this.entityService.restore(id); }
  getListLayout() { return this.entityService.getListLayout(); }
}
