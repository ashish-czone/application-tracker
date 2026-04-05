import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { DatabaseService, sql } from '@packages/database';
import { tenantCondition } from '@packages/tenancy/helpers';
import { WorkflowRegistryService } from '../services/workflow-registry.service';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { PipelineResolverService } from '../services/pipeline-resolver.service';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';
import { CreateStateDto } from '../dto/create-state.dto';
import { UpdateStateDto } from '../dto/update-state.dto';
import { CreateTransitionDto } from '../dto/create-transition.dto';
import { UpdateTransitionDto } from '../dto/update-transition.dto';
import { WORKFLOWS_PERMISSIONS } from '../permissions';

@ApiTags('workflows')
@Controller('workflows')
export class WorkflowsController {
  constructor(
    private readonly workflowRegistry: WorkflowRegistryService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly pipelineResolver: PipelineResolverService,
    private readonly database: DatabaseService,
  ) {}

  // --- Workflow Definitions ---

  @Get()
  @RequirePermission(WORKFLOWS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List all workflow definitions' })
  async list() {
    return this.workflowRegistry.getAll();
  }

  @Get(':slug')
  @RequirePermission(WORKFLOWS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get a workflow definition with states and transitions' })
  async findBySlug(@Param('slug') slug: string) {
    const definition = this.workflowRegistry.getBySlug(slug);
    if (!definition) throw new NotFoundException(`Workflow '${slug}' not found`);
    return definition;
  }

  @Post()
  @RequirePermission(WORKFLOWS_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new workflow definition' })
  async create(@Body() dto: CreateWorkflowDto) {
    return this.workflowRegistry.createDefinition(dto);
  }

  @Patch(':id')
  @RequirePermission(WORKFLOWS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update a workflow definition' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowRegistry.updateDefinition(id, dto);
  }

  @Delete(':id')
  @RequirePermission(WORKFLOWS_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a workflow definition' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.workflowRegistry.deleteDefinition(id);
  }

  // --- Entity Pipeline Resolution ---

  @Get('for-entity/:entityType/:entityId/:fieldName')
  @RequirePermission(WORKFLOWS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get the resolved workflow for a specific entity record' })
  async getWorkflowForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Param('fieldName') fieldName: string,
  ) {
    const workflow = await this.pipelineResolver.resolveForTransition(entityType, entityId, fieldName);
    if (!workflow) throw new NotFoundException(`No workflow found for ${entityType}/${entityId}/${fieldName}`);
    return workflow;
  }

  // --- Transition History ---

  @Get('history/:entityType/:entityId')
  @RequirePermission(WORKFLOWS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get workflow transition history for an entity with resolved actor names' })
  async getHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
  ) {
    const entries = await this.workflowEngine.getHistory(entityType, entityId, {
      limit: limit ? parseInt(limit, 10) : 100,
    });

    // Resolve actor names
    const actorIds = [...new Set(entries.map((e) => e.actorId).filter(Boolean))] as string[];
    const actorNames = new Map<string, string>();
    if (actorIds.length > 0) {
      const users = await this.database.db
        .select({ id: sql`id`, firstName: sql`first_name`, lastName: sql`last_name` })
        .from(sql`users`)
        .where(sql`id IN (${sql.join(actorIds.map((id) => sql`${id}`), sql`, `)}) AND ${tenantCondition()}`) as { id: string; firstName: string; lastName: string }[];
      for (const u of users) {
        actorNames.set(u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim());
      }
    }

    return entries.map((e) => ({
      ...e,
      actorName: e.actorId ? actorNames.get(e.actorId) ?? null : null,
    }));
  }

  // --- States ---

  @Post(':id/states')
  @RequirePermission(WORKFLOWS_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a state to a workflow' })
  async createState(
    @Param('id', ParseUUIDPipe) definitionId: string,
    @Body() dto: CreateStateDto,
  ) {
    return this.workflowRegistry.createState(definitionId, dto);
  }

  @Patch('states/:id')
  @RequirePermission(WORKFLOWS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update a workflow state' })
  async updateState(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStateDto,
  ) {
    return this.workflowRegistry.updateState(id, dto);
  }

  @Delete('states/:id')
  @RequirePermission(WORKFLOWS_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a workflow state' })
  async deleteState(@Param('id', ParseUUIDPipe) id: string) {
    await this.workflowRegistry.deleteState(id);
  }

  // --- Transitions ---

  @Post(':id/transitions')
  @RequirePermission(WORKFLOWS_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a transition to a workflow' })
  async createTransition(
    @Param('id', ParseUUIDPipe) definitionId: string,
    @Body() dto: CreateTransitionDto,
  ) {
    return this.workflowRegistry.createTransition(definitionId, dto);
  }

  @Patch('transitions/:id')
  @RequirePermission(WORKFLOWS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update a workflow transition' })
  async updateTransition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransitionDto,
  ) {
    return this.workflowRegistry.updateTransition(id, dto);
  }

  @Delete('transitions/:id')
  @RequirePermission(WORKFLOWS_PERMISSIONS.MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a workflow transition' })
  async deleteTransition(@Param('id', ParseUUIDPipe) id: string) {
    await this.workflowRegistry.deleteTransition(id);
  }
}
