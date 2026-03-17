import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { RequirePermission } from '@packages/rbac';
import { TasksService } from '../services/tasks.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TransitionTaskDto } from '../dto/transition-task.dto';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto';
import { TASKS_PERMISSIONS } from '../permissions';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermission(TASKS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List tasks with pagination, search, and filtering' })
  async list(@Query() query: ListTasksQueryDto) {
    return this.tasksService.list(query);
  }

  @Get(':id')
  @RequirePermission(TASKS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a single task by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOneOrFail(id);
  }

  @Post()
  @RequirePermission(TASKS_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task' })
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.create(dto, user.userId);
  }

  @Patch(':id')
  @RequirePermission(TASKS_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update a task (status changes use the transition endpoint)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @RequirePermission(TASKS_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a task' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.tasksService.softDelete(id, user.userId);
  }

  @Get(':id/transitions')
  @RequirePermission(TASKS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get available status transitions for a task' })
  async getTransitions(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.getAvailableTransitions(id);
  }

  @Patch(':id/transition')
  @RequirePermission(TASKS_PERMISSIONS.TRANSITION)
  @ApiOperation({ summary: 'Transition task status via workflow engine' })
  async transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.transitionStatus(id, dto.toState, user.userId, dto.comment);
  }
}
