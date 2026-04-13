import { Module } from '@nestjs/common';
import { CandidatesSeedService } from './services/candidates-seed.service';

/**
 * Candidates domain module.
 *
 * CRUD, routing, RBAC, events, audit, field definitions, and layout seeding
 * are now handled by EntityEngineModule.forEntity(candidatesConfig) in app.module.ts.
 *
 * This module provides:
 * - CandidatesSeedService: sample data seeding (skills tag group + sample candidates)
 */
@Module({
  providers: [CandidatesSeedService],
})
export class CandidatesModule {}
