import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { candidatesConfig } from './candidates.config';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';

/**
 * Candidates domain module.
 *
 * `buildListFilters` stays declarative in candidatesConfig — the engine
 * applies it when the list query hits the ENTITY_SERVICE_candidates
 * that this controller delegates to.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(candidatesConfig),
  ],
  controllers: [CandidatesController],
  providers: [CandidatesService],
})
export class CandidatesModule {}
