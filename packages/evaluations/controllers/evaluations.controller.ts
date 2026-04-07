import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth-core';
import { EVALUATIONS_PERMISSIONS } from '../permissions';
import { EvaluationsService } from '../services/evaluations.service';
import { CreateEvaluationDto } from '../dto/create-evaluation.dto';
import { UpdateEvaluationDto } from '../dto/update-evaluation.dto';
import { ListEvaluationsQueryDto } from '../dto/list-evaluations-query.dto';

@ApiTags('evaluations')
@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get()
  @RequirePermission(EVALUATIONS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List evaluations for an entity' })
  list(@Query() query: ListEvaluationsQueryDto) {
    return this.evaluationsService.listForEntity(
      query.entityType,
      query.entityId,
      query.page,
      query.limit,
    );
  }

  @Get(':id')
  @RequirePermission(EVALUATIONS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get evaluation by ID' })
  findById(@Param('id') id: string) {
    return this.evaluationsService.findByIdOrFail(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission(EVALUATIONS_PERMISSIONS.CREATE)
  @ApiOperation({ summary: 'Create an evaluation' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEvaluationDto) {
    return this.evaluationsService.create({
      templateId: dto.templateId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      evaluatorId: user.userId,
      overallRating: dto.overallRating,
      comment: dto.comment,
      scores: dto.scores,
    });
  }

  @Patch(':id')
  @RequirePermission(EVALUATIONS_PERMISSIONS.UPDATE)
  @ApiOperation({ summary: 'Update an evaluation' })
  update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateEvaluationDto) {
    return this.evaluationsService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(EVALUATIONS_PERMISSIONS.DELETE)
  @ApiOperation({ summary: 'Delete an evaluation' })
  async remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.evaluationsService.delete(id, user.userId);
  }
}
