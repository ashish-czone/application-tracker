import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigurableThrottlerGuard } from './guards/configurable-throttler.guard';
import path from 'path';
import { LoggerModule } from '@packages/logger';
import { DatabaseModule } from '@packages/database';
import { TenancyModule, type TenancyMode, type TenantResolver } from '@packages/tenancy';
import { EventsModule } from '@packages/events';
import { SettingsModule } from '@packages/settings';
import { QueueModule } from '@packages/queue';
import { AutomationsModule } from '@packages/automations';
import { NotificationsModule } from '@packages/notifications';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { WorkflowsModule } from '@packages/workflows';
import { WorkflowsEntityEngineModule } from '@packages/workflows-entity-engine';
import { AuditModule, AuditRegistryService } from '@packages/audit';
import { AUDIT_EXTENSION } from '@packages/entity-engine';
import { HierarchyModule } from '@packages/hierarchy';
import { OrderableModule } from '@packages/orderable';
import { MediaModule } from '@packages/media';
import { AuthModule, AuthGuard } from '@packages/auth';
import { OAuthModule } from '@packages/oauth';
import { RbacGuard } from '@packages/rbac';
import { AppConfigService } from '@packages/settings';
import { UsersModule } from './modules/users/users.module';
import { OrgUnitsModule } from './modules/org-units/org-units.module';
import { OrgUnitService } from '@packages/org-units';
import { EntityEngineModule } from '@packages/entity-engine';
import { TasksModule } from '@packages/tasks';
import { TaxonomyModule } from '@packages/taxonomy';
import { NotesModule } from '@packages/notes';
import { AttachmentsModule } from '@packages/attachments';
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
    // Conditionally load TenancyModule when TENANCY_MODE is set
    ...(process.env.TENANCY_MODE ? [
      TenancyModule.registerAsync({
        useFactory: (config: ConfigService) => ({
          mode: config.get<string>('TENANCY_MODE') as TenancyMode,
          resolver: (config.get<string>('TENANCY_RESOLVER') ?? 'header') as TenantResolver,
          headerName: config.get<string>('TENANCY_HEADER'),
          jwtClaim: config.get<string>('TENANCY_JWT_CLAIM'),
        }),
        inject: [ConfigService],
      }),
    ] : []),
    EventsModule,
    SettingsModule,
    QueueModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        redisUrl: config.get<string>('REDIS_URL')!,
        prefix: config.get<string>('BULL_QUEUE_PREFIX'),
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
    OrderableModule,
    WorkflowsModule,
    WorkflowsEntityEngineModule,
    TaxonomyModule,
    NotesModule,
    AttachmentsModule,
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
    OrgUnitsModule,
    TasksModule.forRoot({
      imports: [OrgUnitsModule],
      teamMembersReader: { useExisting: OrgUnitService },
    }),
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
    {
      provide: AUDIT_EXTENSION,
      useExisting: AuditRegistryService,
    },
  ],
})
export class AppModule {}
