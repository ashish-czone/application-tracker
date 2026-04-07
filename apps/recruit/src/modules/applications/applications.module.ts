import { Module, type OnModuleInit } from '@nestjs/common';
import { UserResolverRegistry } from '@packages/automations';
import { DatabaseService } from '@packages/database';
import { ApplicationInterviewersStrategy } from './strategies/application-interviewers.strategy';

/**
 * Applications domain module.
 * CRUD/routing/RBAC/events handled by EntityEngineModule.forEntity(APPLICATIONS_CONFIG).
 * This module registers domain-specific automation strategies.
 */
@Module({
  providers: [ApplicationInterviewersStrategy],
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
