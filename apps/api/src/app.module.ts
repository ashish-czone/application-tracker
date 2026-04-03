import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigurableThrottlerGuard } from './guards/configurable-throttler.guard';
import path from 'path';
import { LoggerModule } from '@packages/logger';
import { DatabaseModule } from '@packages/database';
import { EventsModule } from '@packages/events';
import { SettingsModule } from '@packages/settings';
import { QueueModule } from '@packages/queue';
import { AutomationsModule } from '@packages/automations';
import { NotificationsModule } from '@packages/notifications';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { WorkflowsModule } from '@packages/workflows';
import { AuditModule } from '@packages/audit';
import { HierarchyModule } from '@packages/hierarchy';
import { MediaModule } from '@packages/media';
import { AuthModule, AuthGuard } from '@packages/auth';
import { OAuthModule } from '@packages/oauth';
import { RbacGuard } from '@packages/rbac';
import { AppConfigService } from '@packages/settings';
import { UsersModule } from '@packages/users';
import { EntityEngineModule } from '@packages/entity-engine';
import { TASKS_CONFIG } from '@packages/tasks';
import { TaxonomyModule } from '@packages/taxonomy';
import { NotesModule } from '@packages/notes';
import { SharedModule } from './modules/shared/shared.module';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: path.resolve(__dirname, '../.env'),
    }),
    LoggerModule.register({ provider: 'pino' }),
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
    MediaModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        provider: (config.get<string>('MEDIA_PROVIDER') ?? 'local') as 'local' | 's3',
        localPath: config.get<string>('MEDIA_LOCAL_PATH') ?? './uploads',
        baseUrl: config.get<string>('MEDIA_BASE_URL') ?? 'http://localhost:3000/uploads',
        s3Bucket: config.get<string>('MEDIA_S3_BUCKET'),
        s3Region: config.get<string>('MEDIA_S3_REGION'),
        s3AccessKeyId: config.get<string>('MEDIA_S3_ACCESS_KEY_ID'),
        s3SecretAccessKey: config.get<string>('MEDIA_S3_SECRET_ACCESS_KEY'),
        s3Endpoint: config.get<string>('MEDIA_S3_ENDPOINT'),
        s3ForcePathStyle: config.get<string>('MEDIA_S3_FORCE_PATH_STYLE') === 'true',
        maxFileSize: Number(config.get<string>('MEDIA_MAX_FILE_SIZE')) || undefined,
      }),
      inject: [ConfigService],
    }),
    SharedModule,
    AutomationsModule,
    NotificationChannelsModule,
    NotificationsModule,
    AuditModule,
    HierarchyModule,
    WorkflowsModule,
    TaxonomyModule,
    NotesModule,
    EntityEngineModule,
    AuthModule.registerAsync({
      useFactory: (config: ConfigService, appConfig: AppConfigService) => ({
        jwtSecret: config.get<string>('JWT_SECRET')!,
        accessTokenExpiresIn: appConfig.get('auth', 'accessTokenExpiresIn', '15m'),
        refreshTokenExpiresIn: appConfig.get('auth', 'refreshTokenExpiresIn', '7d'),
        resetTokenExpiresIn: appConfig.get('auth', 'resetTokenExpiresIn', '1h'),
      }),
      inject: [ConfigService, AppConfigService],
    }),
    OAuthModule.register(),
    UsersModule,
    EntityEngineModule.forEntity(TASKS_CONFIG),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
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
      useClass: ConfigurableThrottlerGuard,
    },
  ],
})
export class AppModule {}
