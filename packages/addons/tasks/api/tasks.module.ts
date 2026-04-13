import { Module } from '@nestjs/common';
import { TasksSeedService } from './services/tasks-seed.service';

@Module({
  providers: [TasksSeedService],
})
export class TasksModule {}
