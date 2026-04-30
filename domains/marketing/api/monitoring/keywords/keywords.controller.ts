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
import { MonitoringKeywordsService } from './keywords.service';
import { createMonitoringKeywordSchema } from './dto/create-keyword.dto';
import { updateMonitoringKeywordSchema } from './dto/update-keyword.dto';
import { listMonitoringKeywordsQuerySchema } from './dto/list-keywords-query.dto';
import { MARKETING_PERMISSIONS } from '../../permissions';

@ApiTags('marketing.monitoring-keywords')
@Controller('marketing/monitoring-keywords')
export class MonitoringKeywordsController {
  constructor(private readonly keywords: MonitoringKeywordsService) {}

  @Get()
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_KEYWORDS_READ)
  @ApiOperation({ summary: 'List monitoring keywords (paginated, filterable by source)' })
  list(@Query() query: Record<string, unknown>) {
    const parsed = listMonitoringKeywordsQuerySchema.parse(query);
    return this.keywords.list(parsed);
  }

  @Get(':id')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_KEYWORDS_READ)
  @ApiOperation({ summary: 'Get a single monitoring keyword by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.keywords.findOne(id);
  }

  @Post()
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_KEYWORDS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new monitoring keyword for a source' })
  create(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const input = createMonitoringKeywordSchema.parse(body);
    return this.keywords.create(input, user.userId);
  }

  @Patch(':id')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_KEYWORDS_MANAGE)
  @ApiOperation({ summary: 'Update an existing monitoring keyword' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtPayload,
  ) {
    const input = updateMonitoringKeywordSchema.parse(body);
    return this.keywords.update(id, input, user.userId);
  }

  @Delete(':id')
  @RequirePermission(MARKETING_PERMISSIONS.MONITORING_KEYWORDS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a monitoring keyword' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    await this.keywords.softDelete(id, user.userId);
  }
}
