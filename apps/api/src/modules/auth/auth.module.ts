import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as AuthPackageModule } from '@packages/auth';
import { RbacModule } from '@packages/rbac';
import { EventRegistryService } from '@packages/events';
import { ClientAuthController } from './controllers/client-auth.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { BaseAuthOrchestratorService } from './services/base-auth-orchestrator.service';
import { ClientAuthService } from './services/client-auth.service';
import { AdminAuthService } from './services/admin-auth.service';
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
      useFactory: (config: ConfigService) => ({
        jwtSecret: config.get<string>('JWT_SECRET')!,
        accessTokenExpiresIn: '15m',
        refreshTokenExpiresIn: '7d',
        resetTokenExpiresIn: '1h',
      }),
      inject: [ConfigService],
    }),
    RbacModule,
  ],
  controllers: [ClientAuthController, AdminAuthController],
  providers: [BaseAuthOrchestratorService, ClientAuthService, AdminAuthService],
})
export class AuthOrchestratorModule implements OnModuleInit {
  constructor(private readonly eventRegistry: EventRegistryService) {}

  onModuleInit() {
    this.eventRegistry.register({
      eventName: AUTH_USER_REGISTERED,
      group: 'auth',
      description: 'Fired when a new user registers',
      payloadSchema: {
        email: { type: 'string', label: 'Email' },
        userType: { type: 'string', label: 'User Type' },
      },
    });

    this.eventRegistry.register({
      eventName: AUTH_USER_LOGGED_IN,
      group: 'auth',
      description: 'Fired when a user logs in',
      payloadSchema: {
        userType: { type: 'string', label: 'User Type' },
      },
    });

    this.eventRegistry.register({
      eventName: AUTH_PASSWORD_RESET_REQUESTED,
      group: 'auth',
      description: 'Fired when a password reset is requested',
      payloadSchema: {
        token: { type: 'string', label: 'Reset Token' },
        expiresAt: { type: 'string', label: 'Expires At' },
      },
    });

    this.eventRegistry.register({
      eventName: AUTH_PASSWORD_RESET_COMPLETED,
      group: 'auth',
      description: 'Fired when a password is reset via token',
      payloadSchema: {},
    });

    this.eventRegistry.register({
      eventName: AUTH_PASSWORD_CHANGED,
      group: 'auth',
      description: 'Fired when a user changes their password',
      payloadSchema: {},
    });
  }
}
