import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { EntityService, type BaseListQuery } from '@packages/entity-engine';
import { HierarchyService } from '@packages/hierarchy';
import { OrderableService } from '@packages/orderable';
import type { DataAccessContext } from '@packages/rbac';
import type { CreateMenuItemDto, UpdateMenuItemDto } from '../dto/menu-items.dto';
import { assertMenuItemPayload } from '../menu-items.config';
import { menuItems } from '../schema/menu-items';

@Injectable()
export class MenuItemsService {
  constructor(
    @Inject('ENTITY_SERVICE_menu-items') private readonly entityService: EntityService,
    private readonly database: DatabaseService,
    private readonly hierarchy: HierarchyService,
    private readonly orderable: OrderableService,
  ) {}

  list(query: BaseListQuery, accessCtx?: DataAccessContext) {
    return this.entityService.list(query, accessCtx);
  }

  findOne(id: string, accessCtx?: DataAccessContext) {
    return this.entityService.findOneOrFail(id, accessCtx);
  }

  async create(input: CreateMenuItemDto, actorId: string) {
    await assertMenuItemPayload(input as Record<string, unknown>, { isUpdate: false });

    // Resolve parent path BEFORE create so we can populate path/depth on the
    // freshly inserted row. The kernel no longer auto-fills hierarchy columns.
    const parentId = (input as { parentId?: string | null }).parentId ?? null;
    let parentPath: string | null = null;
    if (parentId) {
      const [parent] = await this.database.db
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, parentId))
        .limit(1);
      if (!parent) {
        throw new BadRequestException(`Parent menu item not found: ${parentId}`);
      }
      parentPath = parent.path;
    }

    const created = await this.entityService.create(input, actorId);
    const { path, depth } = this.hierarchy.computeInsertValues(parentPath, created.id as string);
    await this.database.db
      .update(menuItems)
      .set({ path, depth })
      .where(eq(menuItems.id, created.id as string));

    return this.entityService.findOneOrFail(created.id as string);
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

  async reparent(
    id: string,
    parentId: string | null,
    _actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    await this.entityService.findOneOrFail(id, accessCtx);
    const [node] = await this.database.db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);

    let newParentPath: string | null = null;
    if (parentId) {
      const [parent] = await this.database.db
        .select()
        .from(menuItems)
        .where(eq(menuItems.id, parentId))
        .limit(1);
      if (!parent) {
        throw new NotFoundException(`Parent menu item not found: ${parentId}`);
      }
      newParentPath = parent.path;
    }

    await this.hierarchy.move(
      menuItems,
      menuItems.id,
      menuItems.parentId,
      menuItems.path,
      menuItems.depth,
      id,
      node.path,
      parentId,
      newParentPath,
    );

    return this.entityService.findOneOrFail(id, accessCtx);
  }

  async getAncestors(id: string, accessCtx?: DataAccessContext) {
    const node = await this.entityService.findOneOrFail(id, accessCtx);
    return this.hierarchy.getAncestors(menuItems, menuItems.id, menuItems.path, node.path as string);
  }

  async getDescendants(id: string, accessCtx?: DataAccessContext) {
    const node = await this.entityService.findOneOrFail(id, accessCtx);
    return this.hierarchy.getDescendants(menuItems, menuItems.path, node.path as string);
  }

  async move(
    id: string,
    body: { parentId?: string | null; sortOrder?: number },
    actorId: string,
    accessCtx?: DataAccessContext,
  ) {
    const hasParentIdChange = Object.prototype.hasOwnProperty.call(body, 'parentId');
    const hasSortOrderChange = Object.prototype.hasOwnProperty.call(body, 'sortOrder');
    if (!hasParentIdChange && !hasSortOrderChange) {
      throw new BadRequestException('move() requires at least one of parentId or sortOrder');
    }

    await this.entityService.findOneOrFail(id, accessCtx);

    if (hasParentIdChange) {
      await this.reparent(id, body.parentId ?? null, actorId, accessCtx);
    }

    if (hasSortOrderChange) {
      await this.orderable.setSortOrder(menuItems, menuItems.id, menuItems.sortOrder, id, body.sortOrder as number);
    }

    return this.entityService.findOneOrFail(id, accessCtx);
  }
}
