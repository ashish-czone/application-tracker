import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { WorkflowRegistryService } from '@packages/workflows';

@Injectable()
export class TasksWorkflowSeederService implements OnModuleInit {
  private readonly logger = new Logger(TasksWorkflowSeederService.name);

  constructor(private readonly workflowRegistry: WorkflowRegistryService) {}

  async onModuleInit() {
    await this.seedTaskStatusWorkflow();
  }

  private async seedTaskStatusWorkflow() {
    // Idempotent — skip if already exists
    const existing = this.workflowRegistry.getBySlug('task-status');
    if (existing) {
      this.logger.log('Workflow "task-status" already exists, skipping seed');
      return;
    }

    this.logger.log('Seeding "task-status" workflow...');

    // Create definition
    const definition = await this.workflowRegistry.createDefinition({
      slug: 'task-status',
      name: 'Task Status',
      entityType: 'task',
      fieldName: 'status',
      initialState: 'open',
    });

    // Create states
    const open = await this.workflowRegistry.createState(definition.id, {
      name: 'open',
      label: 'Open',
      color: '#6B7280',
      sortOrder: 0,
    });

    const inProgress = await this.workflowRegistry.createState(definition.id, {
      name: 'in_progress',
      label: 'In Progress',
      color: '#3B82F6',
      sortOrder: 1,
    });

    const done = await this.workflowRegistry.createState(definition.id, {
      name: 'done',
      label: 'Done',
      color: '#10B981',
      sortOrder: 2,
    });

    const cancelled = await this.workflowRegistry.createState(definition.id, {
      name: 'cancelled',
      label: 'Cancelled',
      color: '#EF4444',
      sortOrder: 3,
    });

    // Create transitions
    await this.workflowRegistry.createTransition(definition.id, {
      fromStateId: open.id,
      toStateId: inProgress.id,
      name: 'Start',
      sortOrder: 0,
    });

    await this.workflowRegistry.createTransition(definition.id, {
      fromStateId: inProgress.id,
      toStateId: done.id,
      name: 'Complete',
      sortOrder: 0,
    });

    await this.workflowRegistry.createTransition(definition.id, {
      fromStateId: inProgress.id,
      toStateId: cancelled.id,
      name: 'Cancel',
      sortOrder: 1,
    });

    await this.workflowRegistry.createTransition(definition.id, {
      fromStateId: open.id,
      toStateId: cancelled.id,
      name: 'Cancel',
      sortOrder: 1,
    });

    this.logger.log('Workflow "task-status" seeded successfully');
  }
}
