import { Inject, Injectable } from '@nestjs/common';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateMenuItemDto, UpdateMenuItemDto } from '../dto/menu-items.dto';
import { assertMenuItemPayload } from '../menu-items.config';

@Injectable()
export class MenuItemsService {
  constructor(
    @Inject('ENTITY_SERVICE_menu-items') private readonly entityService: EntityService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateMenuItemDto, actorId: string) {
    await assertMenuItemPayload(input as Record<string, unknown>, { isUpdate: false });
    return this.entityService.create(input, actorId);
  }

  async update(id: string, input: UpdateMenuItemDto, actorId: string, accessCtx?: DataAccessContext) {
    await assertMenuItemPayload(input as Record<string, unknown>, { isUpdate: true });
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

  reparent(id: string, parentId: string | null, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.reparent(id, parentId, actorId, accessCtx);
  }

  getAncestors(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.getAncestors(id, accessCtx);
  }

  getDescendants(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.getDescendants(id, accessCtx);
  }

  move(id: string, body: { parentId?: string | null; sortOrder?: number }, actorId: string, accessCtx?: DataAccessContext) {
    return this.entityService.move(id, body, actorId, accessCtx);
  }
}
