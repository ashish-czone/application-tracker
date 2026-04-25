import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule, LookupResolverService } from '@packages/entity-engine';
import { users } from '@packages/database';
import { ContactResolverRegistry } from '@packages/notifications';
import { OrgUnitsModule } from '@packages/org-units';
import {
  USERS_CONFIG,
  UsersService,
  UsersController,
} from '@packages/users';
import { AppUsersService } from './app-users.service';

/**
 * App-level users module for apps/compliance. Registers the platform users
 * config with the entity-engine and wires the notifications contact
 * resolvers + lookup target. UsersService owns the full write path.
 */
@Module({
  imports: [EntityEngineModule.forEntity(USERS_CONFIG), OrgUnitsModule],
  controllers: [UsersController],
  providers: [{ provide: UsersService, useClass: AppUsersService }],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(
    private readonly contactResolverRegistry: ContactResolverRegistry,
    private readonly usersService: UsersService,
    private readonly lookupResolver: LookupResolverService,
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
  }
}
