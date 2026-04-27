import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { TASKS_CONFIG } from './tasks.config';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [EntityEngineModule.forEntity(TASKS_CONFIG)],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
