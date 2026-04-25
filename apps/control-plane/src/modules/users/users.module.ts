import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule, LookupResolverService } from '@packages/entity-engine';
import { users } from '@packages/database';
import { ContactResolverRegistry } from '@packages/notifications';
import {
  USERS_CONFIG,
  UsersService,
  UsersController,
} from '@packages/users';

/**
 * Control-plane app-level users module. Subset of the api app's wiring —
 * control-plane has no UniqueCheckService, so the email-uniqueness
 * registration step is omitted. The DB-level partial unique index on
 * `users.email WHERE deleted_at IS NULL` enforces uniqueness at the
 * data layer. UsersService owns the full write path.
 */
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
