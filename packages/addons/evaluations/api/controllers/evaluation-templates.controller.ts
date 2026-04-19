import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { EVALUATIONS_PERMISSIONS } from '../permissions';
import { EvaluationTemplatesService } from '../services/evaluation-templates.service';
import { CreateEvaluationTemplateDto } from '../dto/create-evaluation-template.dto';
import { UpdateEvaluationTemplateDto } from '../dto/update-evaluation-template.dto';
import { ListEvaluationTemplatesQueryDto } from '../dto/list-evaluation-templates-query.dto';

@ApiTags('evaluation-templates')
@Controller('evaluation-templates')
export class EvaluationTemplatesController {
  constructor(private readonly templatesService: EvaluationTemplatesService) {}

  @Get()
  @RequirePermission(EVALUATIONS_PERMISSIONS.TEMPLATES_READ)
  @ApiOperation({ summary: 'List evaluation templates' })
  list(@Query() query: ListEvaluationTemplatesQueryDto) {
    return this.templatesService.list(query);
  }

  @Get(':id')
  @RequirePermission(EVALUATIONS_PERMISSIONS.TEMPLATES_READ)
  @ApiOperation({ summary: 'Get evaluation template by ID' })
  findById(@Param('id') id: string) {
    return this.templatesService.findByIdOrFail(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(EVALUATIONS_PERMISSIONS.TEMPLATES_MANAGE)
  @ApiOperation({ summary: 'Create an evaluation template' })
  create(@Body() dto: CreateEvaluationTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(EVALUATIONS_PERMISSIONS.TEMPLATES_MANAGE)
  @ApiOperation({ summary: 'Update an evaluation template' })
  update(@Param('id') id: string, @Body() dto: UpdateEvaluationTemplateDto) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(EVALUATIONS_PERMISSIONS.TEMPLATES_MANAGE)
  @ApiOperation({ summary: 'Delete an evaluation template' })
  async remove(@Param('id') id: string) {
    await this.templatesService.delete(id);
  }
}
