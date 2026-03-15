import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as AuthPackageModule } from '@packages/auth';
import { RbacModule } from '@packages/rbac';
import { ClientAuthController } from './controllers/client-auth.controller';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { BaseAuthOrchestratorService } from './services/base-auth-orchestrator.service';
import { ClientAuthService } from './services/client-auth.service';
import { AdminAuthService } from './services/admin-auth.service';

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
export class AuthOrchestratorModule {}
