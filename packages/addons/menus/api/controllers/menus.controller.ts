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
import { MenusService } from '../services/menus.service';
import { CreateMenuSchema, UpdateMenuSchema } from '../dto/menus.dto';

@ApiTags('menus')
@Controller('menus')
export class MenusController {
  constructor(private readonly menus: MenusService) {}

  @Get('layout/list')
  @RequirePermission('menus.read')
  @ApiOperation({ summary: 'Get list layout config for menus' })
  getListLayout() {
    return this.menus.getListLayout();
  }

  @Get()
  @RequirePermission('menus.read')
  @ApiOperation({ summary: 'List menus' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.menus.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('menus.read')
  @ApiOperation({ summary: 'Get a single menu by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() accessCtx?: DataAccessContext) {
    return this.menus.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('menus.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new menu' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateMenuSchema.parse(body);
    return this.menus.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('menus.update')
  @ApiOperation({ summary: 'Update a menu' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateMenuSchema.parse(body);
    return this.menus.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('menus.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a menu' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.menus.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('menus.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a menu' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.menus.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('menus.update')
  @ApiOperation({ summary: 'Restore a soft-deleted menu' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.menus.restore(id);
  }
}
