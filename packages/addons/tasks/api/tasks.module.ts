import { Module } from '@nestjs/common';
import { OrgUnitsModule } from '@packages/org-units';
import { TasksService } from './services/tasks.service';
import { TaskClaimService } from './services/task-claim.service';
import { TaskClaimController } from './controllers/task-claim.controller';

@Module({
  imports: [OrgUnitsModule],
  controllers: [TaskClaimController],
  providers: [TasksService, TaskClaimService],
  exports: [TasksService],
})
export class TasksModule {}
