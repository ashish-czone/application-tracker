import { Module, type DynamicModule, type OnModuleInit } from '@nestjs/common';
import { RbacModule } from '@packages/rbac';
import { EventRegistryService } from '@packages/events';
import { AppConfigService } from '@packages/settings';
import { AuditRegistryService } from '@packages/audit';
import { AuthService } from './services/auth.service';
import { CredentialsService } from './services/credentials.service';
import { TokensService } from './services/tokens.service';
import { CredentialsRelationHandler } from './relation-handlers/credentials-relation-handler';
import { AuthGuard } from './guards/auth.guard';
import { AuthAdapterRegistry } from './adapters/auth-adapter-registry';
import { PasswordAuthAdapter } from './adapters/password-auth.adapter';
import { AuthOrchestratorService } from './orchestrator/auth-orchestrator.service';
import { ClientAuthService } from './orchestrator/client-auth.service';
import { AdminAuthService } from './orchestrator/admin-auth.service';
import { ClientAuthController } from './controllers/client-auth.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AUTH_MODULE_CONFIG, type AuthModuleConfig } from './types';
import {
  AUTH_USER_REGISTERED,
  AUTH_USER_LOGGED_IN,
  AUTH_PASSWORD_RESET_REQUESTED,
  AUTH_PASSWORD_RESET_COMPLETED,
  AUTH_PASSWORD_CHANGED,
  AUTH_ACCOUNT_LINKED,
} from './events/types';

const AUTH_DEFAULTS = {
  accessTokenExpiresIn: '15m',
  refreshTokenExpiresIn: '7d',
  resetTokenExpiresIn: '1h',
  defaultAdminEmail: 'admin@admin.com',
  defaultAdminPassword: 'Admin1234',
};

export interface AuthModuleAsyncOptions {
  useFactory: (...args: any[]) => AuthModuleConfig | Promise<AuthModuleConfig>;
  inject?: any[];
}

function withDefaults(config: AuthModuleConfig): Required<AuthModuleConfig> {
  return {
    accessTokenExpiresIn: AUTH_DEFAULTS.accessTokenExpiresIn,
    refreshTokenExpiresIn: AUTH_DEFAULTS.refreshTokenExpiresIn,
    resetTokenExpiresIn: AUTH_DEFAULTS.resetTokenExpiresIn,
    defaultAdminEmail: AUTH_DEFAULTS.defaultAdminEmail,
    defaultAdminPassword: AUTH_DEFAULTS.defaultAdminPassword,
    ...config,
  } as Required<AuthModuleConfig>;
}

@Module({})
export class AuthModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistryService,
    private readonly appConfig: AppConfigService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly authAdapterRegistry: AuthAdapterRegistry,
    private readonly passwordAuthAdapter: PasswordAuthAdapter,
  ) {}

  static register(config: AuthModuleConfig): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      imports: [RbacModule],
      controllers: [ClientAuthController, AdminAuthController],
      providers: [
        {
          provide: AUTH_MODULE_CONFIG,
          useValue: withDefaults(config),
        },
        CredentialsService,
        TokensService,
        AuthService,
        AuthGuard,
        AuthAdapterRegistry,
        PasswordAuthAdapter,
        AuthOrchestratorService,
        ClientAuthService,
        AdminAuthService,
        CredentialsRelationHandler,
      ],
      exports: [AuthService, AuthGuard, AuthAdapterRegistry, CredentialsRelationHandler],
    };
  }

  static registerAsync(options: AuthModuleAsyncOptions): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      imports: [RbacModule],
      controllers: [ClientAuthController, AdminAuthController],
      providers: [
        {
          provide: AUTH_MODULE_CONFIG,
          useFactory: async (...args: any[]) => {
            const config = await options.useFactory(...args);
            return withDefaults(config);
          },
          inject: options.inject ?? [],
        },
        CredentialsService,
        TokensService,
        AuthService,
        AuthGuard,
        AuthAdapterRegistry,
        PasswordAuthAdapter,
        AuthOrchestratorService,
        ClientAuthService,
        AdminAuthService,
        CredentialsRelationHandler,
      ],
      exports: [AuthService, AuthGuard, AuthAdapterRegistry, CredentialsRelationHandler],
    };
  }

  onModuleInit() {
    // Register built-in password adapter
    this.authAdapterRegistry.register(this.passwordAuthAdapter);

    this.appConfig.register('auth', {
      label: 'Authentication',
      defaults: {
        accessTokenExpiresIn: AUTH_DEFAULTS.accessTokenExpiresIn,
        refreshTokenExpiresIn: AUTH_DEFAULTS.refreshTokenExpiresIn,
        resetTokenExpiresIn: AUTH_DEFAULTS.resetTokenExpiresIn,
      },
      metadata: {
        accessTokenExpiresIn: { label: 'Access Token Lifetime', type: 'string', description: 'Duration string (e.g., 15m, 1h, 1d)' },
        refreshTokenExpiresIn: { label: 'Refresh Token Lifetime', type: 'string', description: 'Duration string (e.g., 7d, 30d)' },
        resetTokenExpiresIn: { label: 'Password Reset Token Lifetime', type: 'string', description: 'Duration string (e.g., 1h, 24h)' },
      },
    });

    this.auditRegistry.register('auth', {
      events: [AUTH_USER_REGISTERED, AUTH_USER_LOGGED_IN, AUTH_PASSWORD_CHANGED],
      sensitiveFields: ['token', 'password', 'identifier'],
    });

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

    this.eventRegistry.register({
      eventName: AUTH_ACCOUNT_LINKED,
      group: 'auth',
      description: 'Fired when an external auth provider is linked to an existing account',
      payloadSchema: {
        provider: { type: 'string', label: 'Auth Provider' },
        userType: { type: 'string', label: 'User Type' },
      },
    });
  }
}
