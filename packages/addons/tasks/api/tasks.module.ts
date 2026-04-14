import { Module } from '@nestjs/common';
import { TasksSeedService } from './services/tasks-seed.service';
import { TasksService } from './services/tasks.service';

@Module({
  providers: [TasksSeedService, TasksService],
  exports: [TasksService],
})
export class TasksModule {}
