import { Module, type OnModuleInit, Optional, Inject } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { EventRegistryService } from '@packages/events';
import { DatabaseService, users, isNull } from '@packages/database';
import { ContactResolverRegistry } from '@packages/notifications';
import { AuditRegistryService } from '@packages/audit';
import { LookupResolverService } from '@packages/eav-attributes';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { USERS_PERMISSIONS } from './permissions';
import {
  USERS_USER_CREATED,
  USERS_USER_UPDATED,
  USERS_USER_DELETED,
} from './events/types';

/** Token for optional UniqueCheckService injection from app-level SharedModule */
export const UNIQUE_CHECK_SERVICE = 'UNIQUE_CHECK_SERVICE';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistryService,
    private readonly rbacService: RbacService,
    private readonly contactResolverRegistry: ContactResolverRegistry,
    private readonly usersService: UsersService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly lookupResolver: LookupResolverService,
    @Optional() @Inject('UniqueCheckService') private readonly uniqueCheckService?: any,
  ) {}

  onModuleInit() {
    // Register contact resolvers for notification channels
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

    // Register unique fields if UniqueCheckService is available (provided by app SharedModule)
    if (this.uniqueCheckService) {
      this.uniqueCheckService.register('users', {
        table: users,
        idColumn: users.id,
        readPermission: USERS_PERMISSIONS.READ,
        fields: {
          email: { column: users.email, extraCondition: isNull(users.deletedAt) },
        },
      });
    }

    // Register permissions
    this.rbacService.registerPermissions('users', [
      { action: 'create', description: 'Create users' },
      { action: 'read', description: 'View users' },
      { action: 'update', description: 'Update users' },
      { action: 'delete', description: 'Delete users' },
    ]);

    // Register auditable events
    this.auditRegistry.register('users', {
      events: [USERS_USER_CREATED, USERS_USER_UPDATED, USERS_USER_DELETED],
      sensitiveFields: ['passwordHash', 'token'],
    });

    // Register events
    this.eventRegistry.register({
      eventName: USERS_USER_CREATED,
      group: 'users',
      description: 'Fired when a new user is created',
      payloadSchema: {
        email: { type: 'string', label: 'Email' },
        firstName: { type: 'string', label: 'First Name' },
        lastName: { type: 'string', label: 'Last Name' },
        userType: { type: 'string', label: 'User Type' },
      },
    });

    this.eventRegistry.register({
      eventName: USERS_USER_UPDATED,
      group: 'users',
      description: 'Fired when a user is updated',
      payloadSchema: {
        changes: { type: 'array', label: 'Changed Fields' },
      },
    });

    this.eventRegistry.register({
      eventName: USERS_USER_DELETED,
      group: 'users',
      description: 'Fired when a user is soft-deleted',
      payloadSchema: {
        email: { type: 'string', label: 'Email' },
        firstName: { type: 'string', label: 'First Name' },
        lastName: { type: 'string', label: 'Last Name' },
      },
    });
  }
}
