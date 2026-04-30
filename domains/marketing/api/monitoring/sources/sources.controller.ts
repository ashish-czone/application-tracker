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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { RequirePermission } from '@packages/rbac';
import { MonitoringSourcesService } from './sources.service';
import { createMonitoringSourceSchema } from './dto/create-source.dto';
import { updateMonitoringSourceSchema } from './dto/update-source.dto';
import { listMonitoringSourcesQuerySchema } from './dto/list-sources-query.dto';
import { MARKETING_PERMISSIONS } from '../../permissions';

@ApiTags('marketing.monitoring-sources')
@Controller('marketing/monitoring-sources')
export class MonitoringSourcesController {
  constructor(private readonly sources: MonitoringSourcesService) {}

  @Get()
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_SOURCES_READ)
  @ApiOperation({ summary: 'List monitoring sources (paginated, filterable)' })
  list(@Query() query: Record<string, unknown>) {
    const parsed = listMonitoringSourcesQuerySchema.parse(query);
    return this.sources.list(parsed);
  }

  @Get(':id')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_SOURCES_READ)
  @ApiOperation({ summary: 'Get a single monitoring source by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sources.findOne(id);
  }

  @Post()
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_SOURCES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new monitoring source' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = createMonitoringSourceSchema.parse(body);
    return this.sources.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_SOURCES_MANAGE)
  @ApiOperation({ summary: 'Update an existing monitoring source' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
  ) {
    const input = updateMonitoringSourceSchema.parse(body);
    return this.sources.update(id, input, user.userId);
  }

  @Delete(':id')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_SOURCES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a monitoring source' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.sources.softDelete(id, user.userId);
  }
}
