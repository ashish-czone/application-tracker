import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { ComplianceTasksService } from './compliance-tasks.service';
import { CreateComplianceTaskDto } from './dto/create-compliance-task.dto';
import { UpdateComplianceTaskDto } from './dto/update-compliance-task.dto';
import { ListComplianceTasksDto } from './dto/list-compliance-tasks.dto';

/**
 * Owns every mutation that involves the `compliance_tasks` extension row.
 * The generic `/tasks` controller refuses to edit a task with `kind` set,
 * so the only way to touch a compliance task is through here.
 *
 * Permissions live under the `filings` module to match the UI vocabulary
 * (`filings.read` already existed for the filings screen); compliance
 * tasks are the backing entity behind that surface.
 */
@Controller('compliance-tasks')
export class ComplianceTasksController {
  constructor(private readonly service: ComplianceTasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('filings.create')
  async create(@Body() dto: CreateComplianceTaskDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.userId);
  }

  @Get()
  @RequirePermission('filings.read')
  async list(@Query() query: ListComplianceTasksDto) {
    const status = query.status ? query.status.split(',').map((s) => s.trim()) : undefined;
    return this.service.list({
      clientId: query.clientId,
      ruleId: query.ruleId,
      lawId: query.lawId,
      assigneeId: query.assigneeId,
      assigneeTeamId: query.assigneeTeamId,
      status,
      periodFrom: query.periodFrom,
      periodTo: query.periodTo,
      dueFrom: query.dueFrom,
      dueTo: query.dueTo,
      limit: query.limit,
      offset: query.offset,
      orderBy: query.orderBy,
      direction: query.direction,
    });
  }

  @Get(':id')
  @RequirePermission('filings.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.service.findOne(id);
    if (!row) throw new NotFoundException(`Compliance task ${id} not found`);
    return row;
  }

  @Put(':id')
  @RequirePermission('filings.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComplianceTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('filings.delete')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.service.delete(id, user.userId);
  }
}
