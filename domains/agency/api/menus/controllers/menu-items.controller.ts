import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { MenuItemsService } from '../services/menu-items.service';
import { CreateMenuItemSchema, UpdateMenuItemSchema } from '../dto/menu-items.dto';

@ApiTags('menu-items')
@Controller('menu-items')
export class MenuItemsController {
  constructor(private readonly items: MenuItemsService) {}

  @Get('layout/list')
  @RequirePermission('menu-items.read')
  @ApiOperation({ summary: 'Get list layout config for menu items' })
  getListLayout() {
    return this.items.getListLayout();
  }

  @Get()
  @RequirePermission('menu-items.read')
  @ApiOperation({ summary: 'List menu items' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.items.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('menu-items.read')
  @ApiOperation({ summary: 'Get a single menu item by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() accessCtx?: DataAccessContext) {
    return this.items.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('menu-items.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new menu item' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateMenuItemSchema.parse(body);
    return this.items.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('menu-items.update')
  @ApiOperation({ summary: 'Update a menu item' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateMenuItemSchema.parse(body);
    return this.items.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('menu-items.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a menu item' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.items.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('menu-items.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a menu item' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.items.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('menu-items.update')
  @ApiOperation({ summary: 'Restore a soft-deleted menu item' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.items.restore(id);
  }

  @Post(':id/reparent')
  @RequirePermission('menu-items.update')
  @ApiOperation({ summary: 'Move a menu item under a new parent' })
  reparent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { parentId: string | null },
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.items.reparent(id, body.parentId ?? null, user.userId, accessCtx);
  }

  @Get(':id/ancestors')
  @RequirePermission('menu-items.read')
  @ApiOperation({ summary: 'Get the ancestor chain of a menu item' })
  getAncestors(@Param('id', ParseUUIDPipe) id: string, @AccessContext() accessCtx?: DataAccessContext) {
    return this.items.getAncestors(id, accessCtx);
  }

  @Get(':id/descendants')
  @RequirePermission('menu-items.read')
  @ApiOperation({ summary: 'Get all descendants of a menu item' })
  getDescendants(@Param('id', ParseUUIDPipe) id: string, @AccessContext() accessCtx?: DataAccessContext) {
    return this.items.getDescendants(id, accessCtx);
  }

  @Post(':id/move')
  @RequirePermission('menu-items.update')
  @ApiOperation({ summary: 'Move a menu item (reparent and/or reorder)' })
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { parentId?: string | null; sortOrder?: number },
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.items.move(id, body, user.userId, accessCtx);
  }
}
