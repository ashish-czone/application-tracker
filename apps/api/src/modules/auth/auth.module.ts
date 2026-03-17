import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as AuthPackageModule } from '@packages/auth';
import { RbacModule } from '@packages/rbac';
import { EventRegistryService } from '@packages/events';
import { AppConfigService } from '@packages/settings';
import { ClientAuthController } from './controllers/client-auth.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { BaseAuthOrchestratorService } from './services/base-auth-orchestrator.service';
import { ClientAuthService } from './services/client-auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { SeedService } from './services/seed.service';
import {
  AUTH_USER_REGISTERED,
  AUTH_USER_LOGGED_IN,
  AUTH_PASSWORD_RESET_REQUESTED,
  AUTH_PASSWORD_RESET_COMPLETED,
  AUTH_PASSWORD_CHANGED,
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
  controllers: [ClientAuthController, AdminAuthController],
  providers: [BaseAuthOrchestratorService, ClientAuthService, AdminAuthService, SeedService],
  exports: [AuthPackageModule],
})
export class AuthOrchestratorModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistryService,
    private readonly appConfig: AppConfigService,
  ) {}

  onModuleInit() {
    // Register config metadata for admin UI
    this.appConfig.register('auth', {
      label: 'Authentication',
      defaults: {
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
        resetTokenExpiresIn: '1h',
      },
      metadata: {
        accessTokenExpiresIn: { label: 'Access Token Lifetime', type: 'string', description: 'Duration string (e.g., 15m, 1h, 1d)' },
        refreshTokenExpiresIn: { label: 'Refresh Token Lifetime', type: 'string', description: 'Duration string (e.g., 7d, 30d)' },
        resetTokenExpiresIn: { label: 'Password Reset Token Lifetime', type: 'string', description: 'Duration string (e.g., 1h, 24h)' },
      },
    });

    // Register events
    this.eventRegistry.register({
      eventName: AUTH_USER_REGISTERED,
      group: 'auth',
      description: 'Fired when a new user registers',
      payloadSchema: {
        email: { type: 'string', label: 'Email' },
        firstName: { type: 'string', label: 'First Name' },
        lastName: { type: 'string', label: 'Last Name' },
        userType: { type: 'string', label: 'User Type' },
      },
    });

    this.eventRegistry.register({
      eventName: AUTH_USER_LOGGED_IN,
      group: 'auth',
      description: 'Fired when a user logs in',
      payloadSchema: {
        email: { type: 'string', label: 'Email' },
        firstName: { type: 'string', label: 'First Name' },
        lastName: { type: 'string', label: 'Last Name' },
        userType: { type: 'string', label: 'User Type' },
      },
    });

    this.eventRegistry.register({
      eventName: AUTH_PASSWORD_RESET_REQUESTED,
      group: 'auth',
      description: 'Fired when a password reset is requested',
      payloadSchema: {
        identifier: { type: 'string', label: 'Identifier' },
        token: { type: 'string', label: 'Reset Token' },
        expiresAt: { type: 'string', label: 'Expires At' },
        userType: { type: 'string', label: 'User Type' },
      },
    });

    this.eventRegistry.register({
      eventName: AUTH_PASSWORD_RESET_COMPLETED,
      group: 'auth',
      description: 'Fired when a password is reset via token',
      payloadSchema: {
        userType: { type: 'string', label: 'User Type' },
      },
    });

    this.eventRegistry.register({
      eventName: AUTH_PASSWORD_CHANGED,
      group: 'auth',
      description: 'Fired when a user changes their password',
      payloadSchema: {
        email: { type: 'string', label: 'Email' },
        firstName: { type: 'string', label: 'First Name' },
        lastName: { type: 'string', label: 'Last Name' },
        userType: { type: 'string', label: 'User Type' },
      },
    });
  }
}
