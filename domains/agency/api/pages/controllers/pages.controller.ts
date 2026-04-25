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
import { PagesService } from '../services/pages.service';
import { CreatePageSchema, UpdatePageSchema } from '../dto/pages.dto';

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get('layout/list')
  @RequirePermission('pages.read')
  @ApiOperation({ summary: 'Get list layout config for pages' })
  getListLayout() {
    return this.pages.getListLayout();
  }

  @Get()
  @RequirePermission('pages.read')
  @ApiOperation({ summary: 'List pages' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.pages.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('pages.read')
  @ApiOperation({ summary: 'Get a single page by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() accessCtx?: DataAccessContext) {
    return this.pages.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('pages.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new page' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreatePageSchema.parse(body);
    return this.pages.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('pages.update')
  @ApiOperation({ summary: 'Update a page' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdatePageSchema.parse(body);
    return this.pages.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('pages.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a page' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.pages.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('pages.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a page' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.pages.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('pages.update')
  @ApiOperation({ summary: 'Restore a soft-deleted page' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.pages.restore(id);
  }
}
