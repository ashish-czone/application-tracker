import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { FieldDefinitionService } from '../services/field-definition.service';
import type { FieldType } from '../types';
import { FIELD_TYPE_REGISTRY } from '../types';
import { EAV_PERMISSIONS } from '../permissions';
import { CreateFieldDto } from '../dto/create-field.dto';
import { UpdateFieldDto } from '../dto/update-field.dto';

@ApiTags('fields')
@Controller('fields')
export class FieldsController {
  constructor(private readonly fieldDefinitionService: FieldDefinitionService) {}

  @Get('types')
  @RequirePermission(EAV_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get all registered field types with metadata' })
  async getFieldTypes() {
    return FIELD_TYPE_REGISTRY;
  }

  @Get()
  @RequirePermission(EAV_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List field definitions for an entity type' })
  async listFields(@Query('entityType') entityType: string) {
    return this.fieldDefinitionService.listByEntity(entityType);
  }

  @Get(':id')
  @RequirePermission(EAV_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a field definition by ID' })
  async getField(@Param('id') id: string) {
    return this.fieldDefinitionService.findById(id);
  }

  @Post()
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom field' })
  async createField(@Body() dto: CreateFieldDto) {
    return this.fieldDefinitionService.create(dto.entityType, {
      fieldKey: dto.fieldKey,
      label: dto.label,
      fieldType: dto.fieldType as FieldType,
      uiType: dto.uiType,
      isRequired: dto.isRequired,
      isUnique: dto.isUnique,
      isQuickCreate: dto.isQuickCreate,
      isReadonly: dto.isReadonly,
      maxLength: dto.maxLength,
      defaultValue: dto.defaultValue,
      lookupEntity: dto.lookupEntity,
      lookupLabelField: dto.lookupLabelField,
      lookupSearchFields: dto.lookupSearchFields,
      tagGroupSlug: dto.tagGroupSlug,
      categoryGroupSlug: dto.categoryGroupSlug,
      fileAccept: dto.fileAccept,
      fileMaxSize: dto.fileMaxSize,
    });
  }

  @Patch(':id')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update a field definition (label, required, etc.)' })
  async updateField(@Param('id') id: string, @Body() dto: UpdateFieldDto) {
    return this.fieldDefinitionService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom field' })
  async deleteField(@Param('id') id: string) {
    await this.fieldDefinitionService.delete(id);
  }

  @Get(':id/options')
  @RequirePermission(EAV_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get picklist options for a field' })
  async getPicklistOptions(@Param('id') id: string) {
    return this.fieldDefinitionService.getPicklistOptions(id);
  }

  @Post(':id/options')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set picklist options for a field (replaces all)' })
  async setPicklistOptions(
    @Param('id') id: string,
    @Body() body: { options: { label: string; value: string; isDefault?: boolean }[] },
  ) {
    const field = await this.fieldDefinitionService.findById(id);
    if (!field) return;
    await this.fieldDefinitionService.setPicklistOptions(field.entityType, field.fieldKey, body.options);
  }
}
