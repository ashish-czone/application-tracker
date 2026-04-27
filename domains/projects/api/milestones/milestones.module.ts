import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { MILESTONES_CONFIG } from './milestones.config';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';

@Module({
  imports: [EntityEngineModule.forEntity(MILESTONES_CONFIG)],
  controllers: [MilestonesController],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}
