import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule, LookupResolverService } from '@packages/entity-engine';
import { UserRolesRelationHandler } from '@packages/rbac';
import { CredentialsRelationHandler } from '@packages/auth';
import { users } from '@packages/database';
import { ContactResolverRegistry } from '@packages/notifications';
import {
  UsersService,
  UsersController,
  createUsersEntityConfig,
} from '@packages/users';

/**
 * Control-plane app-level users module. Subset of the api app's wiring —
 * control-plane doesn't have a SharedModule / UniqueCheckService, so the
 * email-uniqueness registration step is omitted (the DB-level partial
 * unique index on `users.email WHERE deleted_at IS NULL` still enforces
 * uniqueness at the data layer).
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
  ) {}

  onModuleInit() {
    const credsRel = USERS_CONFIG.relationships!.find((r) => r.name === 'credentials')!;
    credsRel.handler = this.credentialsHandler;
    const rolesRel = USERS_CONFIG.relationships!.find((r) => r.name === 'roles')!;
    rolesRel.handler = this.rolesHandler;

    this.contactResolverRegistry.register('email', (userId) => this.usersService.getEmail(userId));
    this.contactResolverRegistry.register('whatsapp', (userId) => this.usersService.getPhone(userId));

    this.lookupResolver.register({
      entity: 'users',
      table: users,
      labelField: 'firstName',
      labelFields: ['firstName', 'lastName'],
      valueField: 'id',
      searchFields: ['firstName', 'lastName', 'email'],
    });
  }
}
