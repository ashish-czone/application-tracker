import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { FEATURES_CONFIG } from './features.config';
import { FEATURES_WORKFLOW } from './features.workflow';
import { FeaturesController } from './features.controller';
import { FeaturesService } from './features.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(FEATURES_CONFIG),
    WorkflowsModule.forFeature(FEATURES_WORKFLOW),
  ],
  controllers: [FeaturesController],
  providers: [FeaturesService],
  exports: [FeaturesService],
})
export class FeaturesModule {}
