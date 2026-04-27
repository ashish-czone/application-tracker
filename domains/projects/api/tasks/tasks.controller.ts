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
import { TasksService } from './tasks.service';
import {
  CreateTaskSchema,
  TransitionTaskSchema,
  UpdateTaskSchema,
} from './tasks.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('layout/list')
  @RequirePermission('tasks.read')
  getListLayout() {
    return this.tasks.getListLayout();
  }

  @Get('mine')
  @RequirePermission('my-tasks.read')
  mine(@CurrentUser() user: JwtPayload) {
    return this.tasks.listForAssignee(user.userId);
  }

  @Get()
  @RequirePermission('tasks.read')
  list(@Query() query: Record<string, unknown>, @AccessContext() accessCtx?: DataAccessContext) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.tasks.list(parsed, accessCtx);
  }

  @Get(':id')
  @RequirePermission('tasks.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.tasks.findOne(id, accessCtx);
  }

  @Post()
  @RequirePermission('tasks.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateTaskSchema.parse(body);
    return this.tasks.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('tasks.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = UpdateTaskSchema.parse(body);
    return this.tasks.update(id, input, user.userId, accessCtx);
  }

  @Delete(':id')
  @RequirePermission('tasks.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.tasks.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/restore')
  @RequirePermission('tasks.update')
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.restore(id);
  }

  @Post(':id/transition')
  @RequirePermission('tasks.update')
  @HttpCode(HttpStatus.CREATED)
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const input = TransitionTaskSchema.parse(body);
    return this.tasks.transition(
      id,
      input.fieldKey,
      input.to,
      user.userId,
      { reason: input.reason, comment: input.comment },
      accessCtx,
    );
  }
}
