import { Module } from '@nestjs/common';
import { CandidatesExtrasController } from './controllers/candidates-extras.controller';
import { CandidatesSeedService } from './services/candidates-seed.service';

/**
 * Candidates domain module.
 *
 * CRUD, routing, RBAC, events, audit, field definitions, and layout seeding
 * are now handled by EntityEngineModule.forEntity(CANDIDATES_CONFIG) in app.module.ts.
 *
 * This module provides:
 * - CandidatesExtrasController: resume upload, skill attachment
 * - CandidatesSeedService: sample data seeding (skills tag group + sample candidates)
 */
@Module({
  controllers: [CandidatesExtrasController],
  providers: [CandidatesSeedService],
})
export class CandidatesModule {}
