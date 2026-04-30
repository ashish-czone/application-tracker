import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { RequirePermission } from '@packages/rbac';
import { MonitoringItemsService } from './items.service';
import { listMonitoringItemsQuerySchema } from './dto/list-items-query.dto';
import {
  markEngagedSchema,
  dismissItemSchema,
  snoozeItemSchema,
} from './dto/inbox-actions.dto';
import { MARKETING_PERMISSIONS } from '../../permissions';

@ApiTags('marketing.monitoring-items')
@Controller('marketing/monitoring-items')
export class MonitoringItemsController {
  constructor(private readonly items: MonitoringItemsService) {}

  @Get()
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_ITEMS_READ)
  @ApiOperation({ summary: 'List inbox items (paginated, filterable, server-sorted)' })
  list(@Query() query: Record<string, unknown>) {
    const parsed = listMonitoringItemsQuerySchema.parse(query);
    return this.items.list(parsed);
  }

  @Get(':id')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_ITEMS_READ)
  @ApiOperation({ summary: 'Get a single inbox item by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.items.findOne(id);
  }

  @Post(':id/engage')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_ITEMS_TRIAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark item as engaged (operator responded to it)' })
  markEngaged(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
  ) {
    const input = markEngagedSchema.parse(body ?? {});
    return this.items.markEngaged(id, input, user.userId);
  }

  @Post(':id/dismiss')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_ITEMS_TRIAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss item from the inbox' })
  dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
  ) {
    const input = dismissItemSchema.parse(body ?? {});
    return this.items.dismiss(id, input, user.userId);
  }

  @Post(':id/snooze')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_ITEMS_TRIAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Snooze item until a specified time' })
  snooze(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
  ) {
    const input = snoozeItemSchema.parse(body);
    return this.items.snooze(id, input, user.userId);
  }
}
