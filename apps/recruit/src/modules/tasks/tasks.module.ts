import { Module } from '@nestjs/common';
import { OrgUnitsModule } from '@packages/org-units';
import { TaskClaimController } from './controllers/task-claim.controller';
import { TaskClaimService } from './services/task-claim.service';

@Module({
  imports: [OrgUnitsModule],
  controllers: [TaskClaimController],
  providers: [TaskClaimService],
})
export class TasksModule {}
