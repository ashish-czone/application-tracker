import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { EventRegistryService } from '@packages/events';
import { TasksController } from './controllers/tasks.controller';
import { TasksService } from './services/tasks.service';
import { TasksWorkflowSeederService } from './services/tasks-workflow-seeder.service';
import {
  TASKS_TASK_CREATED,
  TASKS_TASK_UPDATED,
  TASKS_TASK_DELETED,
} from './events/types';

@Module({
  controllers: [TasksController],
  providers: [TasksService, TasksWorkflowSeederService],
  exports: [TasksService],
})
export class TasksModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistryService,
    private readonly rbacService: RbacService,
  ) {}

  onModuleInit() {
    // Register permissions
    this.rbacService.registerPermissions('tasks', [
      { action: 'create', description: 'Create tasks' },
      { action: 'read', description: 'View tasks' },
      { action: 'update', description: 'Update tasks' },
      { action: 'delete', description: 'Delete tasks' },
      { action: 'transition', description: 'Transition task status' },
    ]);

    // Register events
    this.eventRegistry.register({
      eventName: TASKS_TASK_CREATED,
      group: 'tasks',
      description: 'Fired when a new task is created',
      payloadSchema: {
        title: { type: 'string', label: 'Title' },
        status: { type: 'string', label: 'Status' },
        priority: { type: 'string', label: 'Priority' },
        assigneeId: { type: 'string', label: 'Assignee ID' },
      },
    });

    this.eventRegistry.register({
      eventName: TASKS_TASK_UPDATED,
      group: 'tasks',
      description: 'Fired when a task is updated',
      payloadSchema: {
        changes: { type: 'array', label: 'Changed Fields' },
      },
    });

    this.eventRegistry.register({
      eventName: TASKS_TASK_DELETED,
      group: 'tasks',
      description: 'Fired when a task is soft-deleted',
      payloadSchema: {
        title: { type: 'string', label: 'Title' },
      },
    });
  }
}
