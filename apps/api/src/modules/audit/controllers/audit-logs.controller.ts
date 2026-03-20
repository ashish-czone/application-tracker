import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { AuditQueryService } from '@packages/audit';
import { ListAuditLogsQueryDto } from '../dto/list-audit-logs-query.dto';
import { AUDIT_PERMISSIONS } from '../permissions';

@ApiTags('audit')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @Get()
  @RequirePermission(AUDIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List audit logs with pagination and filtering' })
  async list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditQueryService.list(query);
  }

  @Get(':id')
  @RequirePermission(AUDIT_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a single audit log entry by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditQueryService.findOneOrFail(id);
  }
}
