import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as AuthPackageModule } from '@packages/auth';
import { RbacModule, RbacService } from '@packages/rbac';
import { EventRegistryService } from '@packages/events';
import { DatabaseService, users, isNull } from '@packages/database';
import { AppConfigService } from '@packages/settings';
import { ContactResolverRegistry } from '@packages/notifications';
import { AuditRegistryService } from '@packages/audit';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { UniqueCheckService } from '../shared/services/unique-check.service';
import { USERS_PERMISSIONS } from './permissions';
import {
  USERS_USER_CREATED,
  USERS_USER_UPDATED,
  USERS_USER_DELETED,
} from './events/types';

@Module({
  imports: [
    AuthPackageModule.registerAsync({
      useFactory: (config: ConfigService, appConfig: AppConfigService) => ({
        jwtSecret: config.get<string>('JWT_SECRET')!,
        accessTokenExpiresIn: appConfig.get('auth', 'accessTokenExpiresIn', '15m'),
        refreshTokenExpiresIn: appConfig.get('auth', 'refreshTokenExpiresIn', '7d'),
        resetTokenExpiresIn: appConfig.get('auth', 'resetTokenExpiresIn', '1h'),
      }),
      inject: [ConfigService, AppConfigService],
    }),
    RbacModule,
  ],
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
    private readonly uniqueCheckService: UniqueCheckService,
    private readonly auditRegistry: AuditRegistryService,
  ) {}

  onModuleInit() {
    // Register contact resolvers for notification channels
    this.contactResolverRegistry.register('email', (userId) => this.usersService.getEmail(userId));
    this.contactResolverRegistry.register('whatsapp', (userId) => this.usersService.getPhone(userId));

    // Register unique fields for check-unique endpoint
    this.uniqueCheckService.register('users', {
      table: users,
      idColumn: users.id,
      readPermission: USERS_PERMISSIONS.READ,
      fields: {
        email: { column: users.email, extraCondition: isNull(users.deletedAt) },
      },
    });

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
