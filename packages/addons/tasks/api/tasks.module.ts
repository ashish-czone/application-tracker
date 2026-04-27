import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { ActionRegistry } from '@packages/automation-contracts';
import { TASKS_CONFIG } from './tasks.config';
import { TasksService } from './services/tasks.service';
import { TaskClaimService } from './services/task-claim.service';
import { TaskActionsService } from './services/task-actions.service';
import { SendTaskDigestAction } from './services/send-task-digest.action';
import { TasksController } from './controllers/tasks.controller';
import { TaskClaimController } from './controllers/task-claim.controller';

@Module({
  imports: [
    EntityEngineModule.forEntity(TASKS_CONFIG),
  ],
  controllers: [TasksController, TaskClaimController],
  providers: [TasksService, TaskClaimService, TaskActionsService, SendTaskDigestAction],
  exports: [TasksService],
})
export class TasksModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly sendTaskDigestAction: SendTaskDigestAction,
  ) {}

  onModuleInit(): void {
    // Register the daily-digest action handler so schedule_recurring rules
    // with action type `send_task_digest` can resolve a handler at runtime.
    this.actionRegistry.register(this.sendTaskDigestAction);
  }
}
