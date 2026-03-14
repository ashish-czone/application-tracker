import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import path from 'path';
import { DatabaseModule, PrismaService } from '@packages/database';
import { EventsModule } from '@packages/events';
import { AuthGuard } from '@packages/auth-nestjs';
import { RbacGuard } from '@packages/rbac-nestjs';
import { SettingsNestjsModule } from '@packages/settings';
import { AdminModule } from './modules/admin/admin.module';
import { IdentityModule } from './modules/identity/identity.module';
import { UsersModule } from './modules/users/users.module';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: path.resolve(__dirname, '../.env'),
    }),
    DatabaseModule,
    EventsModule,
    SettingsNestjsModule.registerAsync({
      useFactory: (prisma: PrismaService) => ({
        getSettingDelegate: () => prisma.setting,
      }),
      inject: [PrismaService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    IdentityModule,
    UsersModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RbacGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
