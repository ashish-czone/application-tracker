import {
  BadRequestException,
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
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { ProjectsService } from './projects.service';
import {
  CreateProjectSchema,
  TransitionProjectSchema,
  UpdateProjectSchema,
} from './projects.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('layout/list')
  @RequirePermission('projects.read')
  getListLayout() {
    return this.projects.getListLayout();
  }

  @Get()
  @RequirePermission('projects.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.projects.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('projects.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.projects.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('projects.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateProjectSchema.parse(body);
    return this.projects.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('projects.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateProjectSchema.parse(body);
    return this.projects.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('projects.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.projects.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/restore')
  @RequirePermission('projects.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.projects.restore(id);
  }

  @Post(':id/clone')
  @RequirePermission('projects.create')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.projects.clone(id, user.userId);
  }

  @Post(':id/transition')
  @RequirePermission('projects.update')
  @HttpCode(HttpStatus.CREATED)
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = TransitionProjectSchema.parse(body);
    if (!input.fieldKey || !input.to) {
      throw new BadRequestException('fieldKey and to are required');
    }
    return this.projects.transition(
      id,
      input.fieldKey,
      input.to,
      user.userId,
      { reason: input.reason, comment: input.comment },
      accessCtx,
    );
  }
}
