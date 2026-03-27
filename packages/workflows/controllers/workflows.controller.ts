import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { WorkflowRegistryService } from '../services/workflow-registry.service';
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
  constructor(private readonly workflowRegistry: WorkflowRegistryService) {}

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
