import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule, LookupResolverService } from '@packages/entity-engine';
import { users, isNull } from '@packages/database';
import { ContactResolverRegistry } from '@packages/notifications';
import { TasksModule } from '@packages/tasks';
import { OrgUnitsModule } from '@packages/org-units';
import {
  USERS_CONFIG,
  UsersService,
  UsersController,
} from '@packages/users';
import { AppUsersService } from './app-users.service';
import { UniqueCheckService } from '../shared/services/unique-check.service';

/**
 * App-level users module. Registers the platform users config with the
 * entity-engine and wires the notifications contact resolver, lookup
 * target, and the email-uniqueness check with the app's UniqueCheckService.
 * UsersService owns the full write path; no per-app handler injection.
 */
@Module({
  imports: [EntityEngineModule.forEntity(USERS_CONFIG), TasksModule, OrgUnitsModule],
  controllers: [UsersController],
  providers: [{ provide: UsersService, useClass: AppUsersService }],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(
    private readonly contactResolverRegistry: ContactResolverRegistry,
    private readonly usersService: UsersService,
    private readonly lookupResolver: LookupResolverService,
    private readonly uniqueCheckService: UniqueCheckService,
  ) {}

  onModuleInit() {
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
