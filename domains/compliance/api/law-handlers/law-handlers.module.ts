import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { LAW_HANDLERS_CONFIG } from './law-handlers.config';
import { LawHandlersController } from './law-handlers.controller';
import { LawHandlersService } from './law-handlers.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(LAW_HANDLERS_CONFIG),
  ],
  controllers: [LawHandlersController],
  providers: [LawHandlersService],
  exports: [LawHandlersService],
})
export class LawHandlersModule {}
