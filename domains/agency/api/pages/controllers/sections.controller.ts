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
import { SectionsService } from '../services/sections.service';
import { CreateSectionSchema, UpdateSectionSchema } from '../dto/sections.dto';

@ApiTags('sections')
@Controller('sections')
export class SectionsController {
  constructor(private readonly sections: SectionsService) {}

  @Get('layout/list')
  @RequirePermission('sections.read')
  @ApiOperation({ summary: 'Get list layout config for sections' })
  getListLayout() {
    return this.sections.getListLayout();
  }

  @Get()
  @RequirePermission('sections.read')
  @ApiOperation({ summary: 'List sections' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.sections.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('sections.read')
  @ApiOperation({ summary: 'Get a single section by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @AccessContext() accessCtx?: DataAccessContext) {
    return this.sections.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('sections.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new section' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateSectionSchema.parse(body);
    return this.sections.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('sections.update')
  @ApiOperation({ summary: 'Update a section' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateSectionSchema.parse(body);
    return this.sections.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('sections.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a section' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.sections.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('sections.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a section' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.sections.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('sections.update')
  @ApiOperation({ summary: 'Restore a deleted section' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.sections.restore(id);
  }
}
