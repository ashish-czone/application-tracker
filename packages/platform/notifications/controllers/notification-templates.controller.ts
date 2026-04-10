import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { NotificationTemplatesService } from '../services/notification-templates.service';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';
import { ListTemplatesQueryDto } from '../dto/list-templates-query.dto';
import { NOTIFICATION_PERMISSIONS } from '../permissions';

@ApiTags('notification-templates')
@Controller('notification-templates')
export class NotificationTemplatesController {
  constructor(private readonly templatesService: NotificationTemplatesService) {}

  @Get()
  @RequirePermission(NOTIFICATION_PERMISSIONS.TEMPLATES_READ)
  @ApiOperation({ summary: 'List notification templates' })
  async list(@Query() query: ListTemplatesQueryDto) {
    return this.templatesService.list(query);
  }

  @Get(':id')
  @RequirePermission(NOTIFICATION_PERMISSIONS.TEMPLATES_READ)
  @ApiOperation({ summary: 'Get a notification template by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findByIdOrFail(id);
  }

  @Post()
  @RequirePermission(NOTIFICATION_PERMISSIONS.TEMPLATES_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a notification template' })
  async create(@Body() dto: CreateTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(NOTIFICATION_PERMISSIONS.TEMPLATES_MANAGE)
  @ApiOperation({ summary: 'Update a notification template' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(NOTIFICATION_PERMISSIONS.TEMPLATES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a notification template' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.templatesService.delete(id);
  }
}
