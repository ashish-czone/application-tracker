import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { DOCUMENT_TEMPLATES_PERMISSIONS } from '../permissions';
import { DocumentTemplatesService } from '../services/document-templates.service';
import { TemplateProviderRegistry } from '../services/template-provider-registry';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { UpdateTemplateDto } from '../dto/update-template.dto';

@ApiTags('document-templates')
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(
    private readonly templatesService: DocumentTemplatesService,
    private readonly providerRegistry: TemplateProviderRegistry,
  ) {}

  @Get()
  @RequirePermission(DOCUMENT_TEMPLATES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List templates, optionally filtered by category' })
  async list(@Query('category') category?: string) {
    return this.templatesService.list(category);
  }

  @Get('categories')
  @RequirePermission(DOCUMENT_TEMPLATES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List registered template categories with their placeholders' })
  async listCategories() {
    const categories = this.providerRegistry.getRegisteredCategories();
    return categories.map((category) => ({
      category,
      placeholders: this.providerRegistry.getPlaceholders(category),
    }));
  }

  @Get(':id')
  @RequirePermission(DOCUMENT_TEMPLATES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a template by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(DOCUMENT_TEMPLATES_PERMISSIONS.CREATE)
  @ApiOperation({ summary: 'Create a new template' })
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: JwtPayload) {
    return this.templatesService.create({ ...dto, createdBy: user.userId });
  }

  @Patch(':id')
  @RequirePermission(DOCUMENT_TEMPLATES_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update a template' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(DOCUMENT_TEMPLATES_PERMISSIONS.DELETE)
  @ApiOperation({ summary: 'Delete a template' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.templatesService.delete(id);
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(DOCUMENT_TEMPLATES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Preview a template with sample placeholder values' })
  async preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.renderPreview(id);
  }

  @Post(':id/render')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(DOCUMENT_TEMPLATES_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Render a template with real values for a given context' })
  async render(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('contextId') contextId: string,
  ) {
    return this.templatesService.render(id, contextId);
  }
}
