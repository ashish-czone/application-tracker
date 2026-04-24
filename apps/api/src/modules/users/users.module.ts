import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule, LookupResolverService } from '@packages/entity-engine';
import { UserRolesRelationHandler } from '@packages/rbac';
import { CredentialsRelationHandler } from '@packages/auth';
import { users, isNull } from '@packages/database';
import { ContactResolverRegistry } from '@packages/notifications';
import {
  UsersService,
  UsersController,
  createUsersEntityConfig,
} from '@packages/users';
import { UniqueCheckService } from '../shared/services/unique-check.service';

/**
 * App-level users module. Owns the wiring the library can't know about:
 * - binds the relation handlers shipped by @packages/auth and @packages/rbac
 * - registers users with the notifications contact resolver so email/whatsapp
 *   dispatch can look up a recipient by userId
 * - registers users as a lookup target for user/multi_user field filters
 * - registers the users.email uniqueness check with the app's UniqueCheckService
 *
 * The entity config is built at module-definition time with placeholder
 * handlers; real handlers are late-bound in onModuleInit once they're
 * available via DI. The engine reads handlers at request time, so the
 * late-binding is visible to every CRUD call (which all fire after
 * onModuleInit).
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
    private readonly uniqueCheckService: UniqueCheckService,
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

    this.uniqueCheckService.register('users', {
      table: users,
      idColumn: users.id,
      readPermission: 'users.read',
      fields: {
        email: { column: users.email, extraCondition: isNull(users.deletedAt) },
      },
    });
  }
}
