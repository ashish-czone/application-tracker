import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { NotificationRulesService } from '@packages/notifications';
import { CreateRuleDto } from '../dto/create-rule.dto';
import { UpdateRuleDto } from '../dto/update-rule.dto';
import { ListRulesQueryDto } from '../dto/list-rules-query.dto';
import { SetRuleChannelsDto } from '../dto/set-rule-channels.dto';
import { NOTIFICATION_RULES_PERMISSIONS } from '../permissions';

@ApiTags('notification-rules')
@Controller('notification-rules')
export class NotificationRulesController {
  constructor(private readonly rulesService: NotificationRulesService) {}

  @Get()
  @RequirePermission(NOTIFICATION_RULES_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'List notification rules' })
  async list(@Query() query: ListRulesQueryDto) {
    return this.rulesService.list(query);
  }

  @Get(':id')
  @RequirePermission(NOTIFICATION_RULES_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'Get a notification rule with channels' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rulesService.findByIdOrFail(id);
  }

  @Post()
  @RequirePermission(NOTIFICATION_RULES_PERMISSIONS.RULES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a notification rule with channels' })
  async create(@Body() dto: CreateRuleDto) {
    return this.rulesService.create(dto as any);
  }

  @Patch(':id')
  @RequirePermission(NOTIFICATION_RULES_PERMISSIONS.RULES_MANAGE)
  @ApiOperation({ summary: 'Update a notification rule' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRuleDto) {
    return this.rulesService.update(id, dto as any);
  }

  @Put(':id/channels')
  @RequirePermission(NOTIFICATION_RULES_PERMISSIONS.RULES_MANAGE)
  @ApiOperation({ summary: 'Set rule channels (full replace)' })
  async setChannels(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRuleChannelsDto) {
    return this.rulesService.setChannels(id, dto.channels as any);
  }

  @Delete(':id')
  @RequirePermission(NOTIFICATION_RULES_PERMISSIONS.RULES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification rule' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.rulesService.delete(id);
  }
}
