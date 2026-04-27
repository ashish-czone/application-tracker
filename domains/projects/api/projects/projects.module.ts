import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { PROJECTS_CONFIG } from './projects.config';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [EntityEngineModule.forEntity(PROJECTS_CONFIG)],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
