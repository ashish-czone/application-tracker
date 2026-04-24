import { Module, type OnModuleInit } from '@nestjs/common';
import { UserResolverRegistry } from '@packages/automations';
import { EntityEngineModule } from '@packages/entity-engine';
import { APPLICATIONS_CONFIG } from './applications.config';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationInterviewersStrategy } from './strategies/application-interviewers.strategy';

/**
 * Applications domain module.
 *
 * Owns HTTP routing + service-layer delegation, and registers the
 * applicationInterviewers automation strategy used by notification rules.
 * The engine is still wired in (layout, RBAC manifests, events, audit)
 * but with controller: 'none' — routing lives on ApplicationsController.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(APPLICATIONS_CONFIG, { controller: 'none' }),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, ApplicationInterviewersStrategy],
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
