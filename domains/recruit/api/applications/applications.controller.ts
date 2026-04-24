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
import { ApplicationsService } from './applications.service';
import { CreateApplicationSchema, UpdateApplicationSchema } from './applications.dto';

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get('layout/list')
  @RequirePermission('applications.read')
  @ApiOperation({ summary: 'Get list layout config for applications' })
  getListLayout() {
    return this.applications.getListLayout();
  }

  @Get()
  @RequirePermission('applications.read')
  @ApiOperation({ summary: 'List applications' })
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.applications.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('applications.read')
  @ApiOperation({ summary: 'Get a single application by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.applications.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('applications.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new application' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateApplicationSchema.parse(body);
    return this.applications.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('applications.update')
  @ApiOperation({ summary: 'Update an application' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateApplicationSchema.parse(body);
    return this.applications.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('applications.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete an application' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.applications.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('applications.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone an application' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.applications.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('applications.update')
  @ApiOperation({ summary: 'Restore a soft-deleted application' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.applications.restore(id);
  }
}
