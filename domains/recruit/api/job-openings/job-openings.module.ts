import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { JOB_OPENINGS_CONFIG } from './job-openings.config';
import { JobOpeningsController } from './job-openings.controller';
import { JobOpeningsService } from './job-openings.service';

@Module({
  imports: [
    EntityEngineModule.forEntity(JOB_OPENINGS_CONFIG),
  ],
  controllers: [JobOpeningsController],
  providers: [JobOpeningsService],
})
export class JobOpeningsModule {}
