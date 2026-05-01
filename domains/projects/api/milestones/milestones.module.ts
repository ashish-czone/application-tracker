import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { MILESTONES_CONFIG } from './milestones.config';
import { MILESTONES_WORKFLOW } from './milestones.workflow';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(MILESTONES_CONFIG),
    WorkflowsModule.forFeature(MILESTONES_WORKFLOW),
  ],
  controllers: [MilestonesController],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
