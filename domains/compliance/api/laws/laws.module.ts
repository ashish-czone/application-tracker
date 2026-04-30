import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { LAWS_CONFIG } from './laws.config';
import { LawsController } from './laws.controller';
import { LawsService } from './laws.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(LAWS_CONFIG),
  ],
  controllers: [LawsController],
  providers: [LawsService],
  exports: [LawsService],
})
export class LawsModule {}
