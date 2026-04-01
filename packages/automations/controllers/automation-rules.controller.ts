import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { AutomationRuleService } from '../services/automation-rule.service';
import { CreateRuleDto } from '../dto/create-rule.dto';
import { UpdateRuleDto } from '../dto/update-rule.dto';
import { ListRulesQueryDto } from '../dto/list-rules-query.dto';
import { AUTOMATION_PERMISSIONS } from '../permissions';

@ApiTags('automation-rules')
@Controller('automation-rules')
export class AutomationRulesController {
  constructor(private readonly ruleService: AutomationRuleService) {}

  @Get()
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'List automation rules' })
  async list(@Query() query: ListRulesQueryDto) {
    return this.ruleService.list(query);
  }

  @Get(':id')
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_READ)
  @ApiOperation({ summary: 'Get an automation rule' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ruleService.findByIdOrFail(id);
  }

  @Post()
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an automation rule' })
  async create(@Body() dto: CreateRuleDto) {
    return this.ruleService.create(dto as any);
  }

  @Patch(':id')
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_MANAGE)
  @ApiOperation({ summary: 'Update an automation rule' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRuleDto) {
    return this.ruleService.update(id, dto as any);
  }

  @Delete(':id')
  @RequirePermission(AUTOMATION_PERMISSIONS.RULES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an automation rule' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.ruleService.delete(id);
  }
}
