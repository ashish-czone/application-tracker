import { Controller, Get, Post, Patch, Delete, Put, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { LayoutService } from '../services/layout.service';
import { EAV_PERMISSIONS } from '../permissions';
import { CreateSectionDto } from '../dto/create-section.dto';
import { UpdateSectionDto } from '../dto/update-section.dto';
import { ReorderFieldsDto } from '../dto/reorder-fields.dto';
import { AddFieldToSectionDto } from '../dto/add-field-to-section.dto';
import { ReorderSectionsDto } from '../dto/reorder-sections.dto';

@ApiTags('layouts')
@Controller('layouts')
export class LayoutsController {
  constructor(private readonly layoutService: LayoutService) {}

  @Get(':entityType')
  @RequirePermission(EAV_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get full layout for an entity type' })
  async getLayout(@Param('entityType') entityType: string) {
    return this.layoutService.getLayout(entityType);
  }

  @Post(':entityType/sections')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a section in a layout' })
  async createSection(
    @Param('entityType') entityType: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.layoutService.createSection(entityType, 'Standard', dto);
  }

  @Patch(':entityType/sections/:sectionId')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update a section' })
  async updateSection(
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.layoutService.updateSection(sectionId, dto);
  }

  @Delete(':entityType/sections/:sectionId')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a section' })
  async deleteSection(@Param('sectionId') sectionId: string) {
    await this.layoutService.deleteSection(sectionId);
  }

  @Put(':entityType/sections/reorder')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Reorder sections' })
  async reorderSections(
    @Param('entityType') entityType: string,
    @Body() dto: ReorderSectionsDto,
  ) {
    await this.layoutService.reorderSections(entityType, 'Standard', dto.orderedIds);
  }

  @Post(':entityType/sections/:sectionId/fields')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a field to a section' })
  async addFieldToSection(
    @Param('sectionId') sectionId: string,
    @Body() dto: AddFieldToSectionDto,
  ) {
    await this.layoutService.addFieldToSection(sectionId, dto.fieldId, dto.columnIndex);
  }

  @Delete(':entityType/sections/:sectionId/fields/:fieldId')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a field from a section' })
  async removeFieldFromSection(
    @Param('sectionId') sectionId: string,
    @Param('fieldId') fieldId: string,
  ) {
    await this.layoutService.removeFieldFromSection(sectionId, fieldId);
  }

  @Put(':entityType/sections/:sectionId/fields/reorder')
  @RequirePermission(EAV_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Reorder fields within a section (supports column-aware ordering)' })
  async reorderFields(
    @Param('sectionId') sectionId: string,
    @Body() dto: ReorderFieldsDto,
  ) {
    await this.layoutService.reorderFieldsInSection(
      sectionId,
      dto.orderedFields ?? dto.orderedFieldIds ?? [],
    );
  }
}
