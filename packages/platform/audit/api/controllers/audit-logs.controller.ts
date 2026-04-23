import { Controller, Get, Param, Query, ParseUUIDPipe, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { AuditRegistryService } from '../services/audit-registry.service';
import { AuditQueryService } from '../services/audit-query.service';
import { ListAuditLogsQueryDto } from '../dto/list-audit-logs-query.dto';
import { AUDIT_PERMISSIONS } from '../permissions';

function hasPermission(user: JwtPayload, permission: string): boolean {
  const permissions = (user.permissions ?? {}) as Record<string, string>;
  return '*' in permissions || permission in permissions;
}

@ApiTags('audit')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(
    private readonly auditQueryService: AuditQueryService,
    private readonly registry: AuditRegistryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs. Per-entity queries inherit the subject entity read-check; other queries require audit.read_all.' })
  async list(@Query() query: ListAuditLogsQueryDto, @CurrentUser() user: JwtPayload) {
    await this.assertReadable(user, query.entityType, query.entityId);
    return this.auditQueryService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single audit log entry by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    const record = await this.auditQueryService.findOneOrFail(id);
    await this.assertReadable(user, record.entityType, record.entityId);
    return record;
  }

  private async assertReadable(
    user: JwtPayload,
    entityType: string | undefined,
    entityId: string | undefined,
  ): Promise<void> {
    const isPerEntity = Boolean(entityType && entityId);
    if (!isPerEntity) {
      if (!hasPermission(user, AUDIT_PERMISSIONS.READ_ALL)) {
        throw new ForbiddenException('Firm-wide audit queries require audit.read_all');
      }
      return;
    }

    const match = this.registry.findRegistrationByEntityType(entityType!);
    const authoriseRead = match?.registration.authoriseRead;
    if (!authoriseRead) {
      // No read-delegation registered for this entityType — fall back to the
      // firm-wide permission so auditable-but-unregistered entities aren't
      // silently readable.
      if (!hasPermission(user, AUDIT_PERMISSIONS.READ_ALL)) {
        throw new ForbiddenException('No audit read authorisation registered for this entity type');
      }
      return;
    }

    const allowed = await authoriseRead({ user, entityType: entityType!, entityId: entityId! });
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to view this entity\'s audit trail');
    }
  }
}
