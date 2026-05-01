import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { PROJECTS_CONFIG } from './projects.config';
import { PROJECTS_WORKFLOW } from './projects.workflow';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(PROJECTS_CONFIG),
    WorkflowsModule.forFeature(PROJECTS_WORKFLOW),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
