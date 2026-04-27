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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import {
  AccessContext,
  RequirePermission,
  type DataAccessContext,
} from '@packages/rbac';
import { TasksService } from '../services/tasks.service';
import { CreateTaskSchema, UpdateTaskSchema } from '../dto/tasks.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('layout/list')
  @RequirePermission('tasks.read')
  @ApiOperation({ summary: 'Get list layout config for tasks' })
  getListLayout() {
    return this.tasks.getListLayout();
  }

  @Get()
  @RequirePermission('tasks.read')
  @ApiOperation({ summary: 'List tasks' })
  list(
    @Query() query: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    const parsed = {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      includeDeleted: query.includeDeleted === 'true',
    };
    return this.tasks.list(parsed, accessCtx, user);
  }

  @Get(':id')
  @RequirePermission('tasks.read')
  @ApiOperation({ summary: 'Get a single task by ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    return this.tasks.findOne(id, accessCtx, user);
  }

  @Post()
  @RequirePermission('tasks.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = CreateTaskSchema.parse(body);
    return this.tasks.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission('tasks.update')
  @ApiOperation({ summary: 'Update a task' })
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
  @ApiOperation({ summary: 'Soft delete a task' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @AccessContext() accessCtx?: DataAccessContext,
  ) {
    await this.tasks.softDelete(id, user.userId, accessCtx);
  }

  @Post(':id/clone')
  @RequirePermission('tasks.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone a task' })
  clone(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.tasks.clone(id, user.userId);
  }

  @Post(':id/restore')
  @RequirePermission('tasks.update')
  @ApiOperation({ summary: 'Restore a soft-deleted task' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.restore(id);
  }
}
