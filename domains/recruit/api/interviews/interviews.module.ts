import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { INTERVIEWS_CONFIG } from './interviews.config';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(INTERVIEWS_CONFIG, { controller: 'none' }),
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule {}
