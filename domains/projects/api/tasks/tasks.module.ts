import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { TASKS_CONFIG } from './tasks.config';
import { TASKS_WORKFLOW } from './tasks.workflow';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(TASKS_CONFIG),
    WorkflowsModule.forFeature(TASKS_WORKFLOW),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
