import { Module, type OnModuleInit } from '@nestjs/common';
import { OrgUnitsModule } from '@packages/org-units';
import { TasksService } from './services/tasks.service';
import { TaskClaimService } from './services/task-claim.service';
import { TaskClaimController } from './controllers/task-claim.controller';
import { registerTasksKindLookup } from './tasks.config';

@Module({
  imports: [OrgUnitsModule],
  controllers: [TaskClaimController],
  providers: [TasksService, TaskClaimService],
  exports: [TasksService],
})
export class TasksModule implements OnModuleInit {
  constructor(private readonly tasksService: TasksService) {}

  onModuleInit(): void {
    // Wire the entity-engine hook guard (in TASKS_CONFIG) to the
    // TasksService.getKind lookup. The hook lives in a static config
    // so it can't hold a DI'd service reference directly — this
    // indirection gives it the DB-backed check at runtime while
    // keeping the config itself pure.
    registerTasksKindLookup((id) => this.tasksService.getKind(id));
  }
}
