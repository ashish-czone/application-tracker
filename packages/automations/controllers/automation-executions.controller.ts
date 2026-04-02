import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { ExecutionLogService } from '../services/execution-log.service';
import { ListExecutionsQueryDto } from '../dto/list-executions-query.dto';
import { AUTOMATION_PERMISSIONS } from '../permissions';

@ApiTags('automation-executions')
@Controller('automation-executions')
export class AutomationExecutionsController {
  constructor(private readonly executionLogService: ExecutionLogService) {}

  @Get()
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'List automation execution logs' })
  async list(@Query() query: ListExecutionsQueryDto) {
    return this.executionLogService.list(query);
  }
}
