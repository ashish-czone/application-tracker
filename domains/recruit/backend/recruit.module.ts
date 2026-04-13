import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { CandidatesModule } from './candidates/candidates.module';
import { candidatesConfig } from './candidates/candidates.config';

/**
 * Aggregates every NestJS module contributed by the Recruit domain,
 * including the per-entity wiring produced by EntityEngineModule.forEntity.
 *
 * Apps consume this via the recruitBackend manifest — they never import
 * individual sub-modules directly.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(candidatesConfig),
    CandidatesModule,
  ],
})
export class RecruitDomainModule {}
