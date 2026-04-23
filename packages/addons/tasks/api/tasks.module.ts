import { Module, type OnModuleInit } from '@nestjs/common';
import { OrgUnitsModule } from '@packages/org-units';
import { ActionRegistry } from '@packages/automation-contracts';
import { TasksService } from './services/tasks.service';
import { TaskClaimService } from './services/task-claim.service';
import { SendTaskDigestAction } from './services/send-task-digest.action';
import { TaskClaimController } from './controllers/task-claim.controller';

@Module({
  imports: [OrgUnitsModule],
  controllers: [TaskClaimController],
  providers: [TasksService, TaskClaimService, SendTaskDigestAction],
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
