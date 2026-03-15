import { Module, type DynamicModule } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { CredentialsService } from './services/credentials.service';
import { TokensService } from './services/tokens.service';
import { AuthGuard } from './guards/auth.guard';
import { AUTH_MODULE_CONFIG, type AuthModuleConfig } from './types';

@Module({})
export class AuthModule {
  static register(config: AuthModuleConfig): DynamicModule {
    return {
      module: AuthModule,
      providers: [
        {
          provide: AUTH_MODULE_CONFIG,
          useValue: config,
        },
        CredentialsService,
        TokensService,
        AuthService,
        AuthGuard,
      ],
      exports: [AuthService, AuthGuard],
    };
  }
}
