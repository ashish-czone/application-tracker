import { Module, type OnModuleInit, Optional, Inject } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { UserRolesRelationHandler } from '@packages/rbac';
import { CredentialsRelationHandler } from '@packages/auth';
import { users, isNull } from '@packages/database';
import { ContactResolverRegistry } from '@packages/notifications';
import { LookupResolverService } from '@packages/entity-engine';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { createUsersEntityConfig } from './users.config';
import { USERS_POSITIONS_READER } from './users-positions-reader.token';

/** Token for optional UniqueCheckService injection from app-level SharedModule */
export const UNIQUE_CHECK_SERVICE = 'UNIQUE_CHECK_SERVICE';

export { USERS_POSITIONS_READER };

/**
 * Module-level entity config. Built once at module-definition time with
 * placeholder relation handlers — swapped in at `onModuleInit` when the
 * owning auth/rbac services are available via DI. The engine reads the
 * handlers at request time, so the late-binding is safe: every entity
 * request fires after onModuleInit.
 */
const USERS_CONFIG = createUsersEntityConfig({
  credentialsHandler: {} as any,
  rolesHandler: {} as any,
});

@Module({
  imports: [EntityEngineModule.forEntity(USERS_CONFIG)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(
    private readonly contactResolverRegistry: ContactResolverRegistry,
    private readonly usersService: UsersService,
    private readonly lookupResolver: LookupResolverService,
    private readonly credentialsHandler: CredentialsRelationHandler,
    private readonly rolesHandler: UserRolesRelationHandler,
    @Optional() @Inject(UNIQUE_CHECK_SERVICE) private readonly uniqueCheckService?: any,
  ) {}

  onModuleInit() {
    // Late-bind relation handlers. The config object was created at
    // module-definition time with placeholders; the engine reads handlers at
    // request time, so swapping them in here is visible to every subsequent
    // CRUD call.
    const credsRel = USERS_CONFIG.relationships!.find((r) => r.name === 'credentials')!;
    credsRel.handler = this.credentialsHandler;
    const rolesRel = USERS_CONFIG.relationships!.find((r) => r.name === 'roles')!;
    rolesRel.handler = this.rolesHandler;

    // Contact resolvers for notification channels — not covered by entity-engine
    this.contactResolverRegistry.register('email', (userId) => this.usersService.getEmail(userId));
    this.contactResolverRegistry.register('whatsapp', (userId) => this.usersService.getPhone(userId));

    // Register users as a lookup entity for user/multi_user field filters
    this.lookupResolver.register({
      entity: 'users',
      table: users,
      labelField: 'firstName',
      labelFields: ['firstName', 'lastName'],
      valueField: 'id',
      searchFields: ['firstName', 'lastName', 'email'],
    });

    // Unique-field registration for the app-level unique check (if provided)
    if (this.uniqueCheckService) {
      this.uniqueCheckService.register('users', {
        table: users,
        idColumn: users.id,
        readPermission: 'users.read',
        fields: {
          email: { column: users.email, extraCondition: isNull(users.deletedAt) },
        },
      });
    }

    // Permissions, audit event registration, and domain event registration
    // are all handled by EntityEngineModule.forEntity() during
    // onApplicationBootstrap. No manual registration needed here.
  }
}
