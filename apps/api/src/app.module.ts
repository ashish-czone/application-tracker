import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import path from 'path';
import { DatabaseModule } from '@packages/database';
import { EventsModule } from '@packages/events';
import { SettingsModule } from '@packages/settings';
import { QueueModule } from '@packages/queue';
import { NotificationsModule } from '@packages/notifications';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { AuthGuard } from '@packages/auth';
import { RbacGuard } from '@packages/rbac';
import { AuthOrchestratorModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacManagementModule } from './modules/rbac/rbac.module';
import { NotificationRulesModule } from './modules/notification-rules/notification-rules.module';
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
    SettingsModule,
    QueueModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        redisUrl: config.get<string>('REDIS_URL')!,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    NotificationChannelsModule,
    NotificationsModule,
    AuthOrchestratorModule,
    UsersModule,
    RbacManagementModule,
    NotificationRulesModule,
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
