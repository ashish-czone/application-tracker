import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
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
  @ApiOperation({ summary: 'List templates, optionally filtered by category' })
  async list(@Query('category') category?: string) {
    return this.templatesService.list(category);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List registered template categories with their placeholders' })
  async listCategories() {
    const categories = this.providerRegistry.getRegisteredCategories();
    return categories.map((category) => ({
      category,
      placeholders: this.providerRegistry.getPlaceholders(category),
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new template' })
  async create(@Body() dto: CreateTemplateDto, @CurrentUser() user: JwtPayload) {
    return this.templatesService.create({ ...dto, createdBy: user.userId });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a template' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a template' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.templatesService.delete(id);
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview a template with sample placeholder values' })
  async preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.renderPreview(id);
  }

  @Post(':id/render')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Render a template with real values for a given context' })
  async render(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('contextId') contextId: string,
  ) {
    return this.templatesService.render(id, contextId);
  }
}
