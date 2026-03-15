import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as AuthPackageModule } from '@packages/auth';
import { RbacModule } from '@packages/rbac';
import { AppConfigService } from '@packages/settings';
import { UsersService } from './services/users.service';

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
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
