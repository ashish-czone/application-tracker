import { Module, type OnModuleInit } from '@nestjs/common';
import { UserResolverRegistry } from '@packages/automations';
import { ApplicationInterviewersStrategy } from './strategies/application-interviewers.strategy';
import { ApplicationsAutomationsSeedService } from './applications-automations-seed.service';
import { ApplicationsEvaluationsSeedService } from './applications-evaluations-seed.service';

/**
 * Applications domain module.
 * CRUD/routing/RBAC/events handled by EntityEngineModule.forEntity(APPLICATIONS_CONFIG).
 * This module registers domain-specific automation strategies and seed data.
 */
@Module({
  providers: [ApplicationInterviewersStrategy, ApplicationsAutomationsSeedService, ApplicationsEvaluationsSeedService],
})
export class ApplicationsModule implements OnModuleInit {
  constructor(
    private readonly userResolverRegistry: UserResolverRegistry,
    private readonly applicationInterviewersStrategy: ApplicationInterviewersStrategy,
  ) {}

  onModuleInit() {
    this.userResolverRegistry.registerStrategy(this.applicationInterviewersStrategy);
  }
}
