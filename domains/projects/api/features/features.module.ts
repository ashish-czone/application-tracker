import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { FEATURES_CONFIG } from './features.config';
import { FeaturesController } from './features.controller';
import { FeaturesService } from './features.service';

@Module({
  imports: [EntityEngineModule.forEntity(FEATURES_CONFIG)],
  controllers: [FeaturesController],
  providers: [FeaturesService],
  exports: [FeaturesService],
})
export class FeaturesModule {}
