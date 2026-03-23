import { Module } from '@nestjs/common';
import { JobOpeningsSeedService } from './job-openings-seed.service';

/**
 * Job Openings domain module.
 * CRUD/routing/RBAC/events handled by EntityEngineModule.forEntity(JOB_OPENINGS_CONFIG).
 * This module provides sample data seeding only.
 */
@Module({
  providers: [JobOpeningsSeedService],
})
export class JobOpeningsModule {}
