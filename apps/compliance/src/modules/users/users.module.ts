import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule, LookupResolverService } from '@packages/entity-engine';
import { users } from '@packages/database';
import { ContactResolverRegistry } from '@packages/notifications';
import { OrgUnitService } from '@packages/org-units';
import { OrgUnitsModule } from '../org-units/org-units.module';
import {
  USERS_CONFIG,
  USERS_POSITIONS_READER,
  UsersService,
  UsersController,
} from '@packages/users';
import { ComplianceFilingsModule } from '@domains/compliance-api/compliance-filings/compliance-filings.module';
import { AppUsersService } from './app-users.service';

/**
 * App-level users module for apps/compliance. Registers the platform users
 * config with the entity-engine and wires the notifications contact
 * resolvers + lookup target. UsersService owns the full write path.
 *
 * ComplianceFilingsModule is imported so AppUsersService can call into
 * the filings assignee-cleanup cascade when a user is soft-deleted
 * (US-7.4 / US-12.2 / US-12.3).
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(USERS_CONFIG),
    OrgUnitsModule,
    ComplianceFilingsModule,
  ],
  controllers: [UsersController],
  providers: [
    { provide: UsersService, useClass: AppUsersService },
    { provide: USERS_POSITIONS_READER, useExisting: OrgUnitService },
  ],
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
