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
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { MilestonesService } from './milestones.service';
import {
  CreateMilestoneSchema,
  TransitionMilestoneSchema,
  UpdateMilestoneSchema,
} from './milestones.dto';

@Controller('milestones')
export class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get('layout/list')
  @RequirePermission('milestones.read')
  getListLayout() {
    return this.milestones.getListLayout();
  }

  @Get()
  @RequirePermission('milestones.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.milestones.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('milestones.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.milestones.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('milestones.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateMilestoneSchema.parse(body);
    return this.milestones.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('milestones.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateMilestoneSchema.parse(body);
    return this.milestones.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('milestones.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.milestones.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/restore')
  @RequirePermission('milestones.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.milestones.restore(id);
  }

  @Post(':id/transition')
  @RequirePermission('milestones.update')
  @HttpCode(HttpStatus.CREATED)
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = TransitionMilestoneSchema.parse(body);
    return this.milestones.transition(
      id,
      input.fieldKey,
      input.to,
      user.userId,
      { reason: input.reason, comment: input.comment },
      accessCtx,
    );
  }
}
