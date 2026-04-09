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
import { ServiceAuthModule } from '@packages/service-auth';
import { EventsModule } from '@packages/events';
import { SettingsModule } from '@packages/settings';
import { QueueModule } from '@packages/queue';
import { AutomationsModule } from '@packages/automations';
import { NotificationsModule } from '@packages/notifications';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { WorkflowsModule } from '@packages/workflows';
import { AuditModule } from '@packages/audit';
import { MediaModule } from '@packages/media';
import { AuthModule, AuthGuard } from '@packages/auth';
import { OAuthModule } from '@packages/oauth';
import { RbacGuard } from '@packages/rbac';
import { AppConfigService } from '@packages/settings';
import { TaxonomyModule } from '@packages/taxonomy';
import { NotesModule } from '@packages/notes';
import { EvaluationsModule } from '@packages/evaluations';
import { AttachmentsModule } from '@packages/attachments';
import { HierarchyModule } from '@packages/hierarchy';
import { EavAttributesModule } from '@packages/eav-attributes';
import { EntityRelationsModule } from '@packages/entity-relations';
import { EntityLayoutModule } from '@packages/entity-layout';
import { EntityEngineModule } from '@packages/entity-engine';
import { DocumentTemplatesModule } from '@packages/document-templates';
import { SharedModule } from './modules/shared/shared.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { CLIENTS_CONFIG } from './modules/clients/clients.config';
import { CONTACTS_CONFIG } from './modules/contacts/contacts.config';
import { VENDORS_CONFIG } from './modules/vendors/vendors.config';
import { candidatesConfig } from './modules/candidates/candidates.config';
import { JOB_OPENINGS_CONFIG } from './modules/job-openings/job-openings.config';
import { APPLICATIONS_CONFIG } from './modules/applications/applications.config';
import { INTERVIEWS_CONFIG } from './modules/interviews/interviews.config';
import { offersConfig } from './modules/offers/offers.config';
import { OffersModule } from './modules/offers/offers.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { ClientsModule } from './modules/clients/clients.module';
import { JobOpeningsModule } from './modules/job-openings/job-openings.module';
import { TASKS_CONFIG } from '@packages/tasks';
import { UsersModule } from '@packages/users';
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
    // Conditionally load multi-tenancy when TENANCY_MODE is set
    ...(process.env.TENANCY_MODE ? [
      TenancyModule.registerAsync({
        useFactory: (config: ConfigService) => ({
          mode: config.get<string>('TENANCY_MODE') as TenancyMode,
          resolver: (config.get<string>('TENANCY_RESOLVER') ?? 'header') as TenantResolver,
          headerName: config.get<string>('TENANCY_HEADER'),
          controlPlaneUrl: config.get<string>('CONTROL_PLANE_URL'),
        }),
        inject: [ConfigService],
      }),
      ServiceAuthModule.registerAsync({
        useFactory: (config: ConfigService) => ({
          serviceId: 'recruit-app',
          privateKey: config.get<string>('SERVICE_PRIVATE_KEY')!,
          trustedServices: JSON.parse(config.get<string>('TRUSTED_SERVICE_KEYS') || '{}'),
        }),
        inject: [ConfigService],
      }),
    ] : []),
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
        baseUrl: config.get<string>('MEDIA_BASE_URL') ?? `http://localhost:${config.get<string>('PORT') ?? '3001'}/uploads`,
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
    WorkflowsModule,
    HierarchyModule,
    TaxonomyModule,
    NotesModule,
    EvaluationsModule,
    AttachmentsModule,
    EavAttributesModule,
    EntityRelationsModule,
    EntityLayoutModule,
    EntityEngineModule,
    DocumentTemplatesModule.register(),
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
    // Domain modules — entity engine handles CRUD/routing/RBAC/events/audit/seeding
    EntityEngineModule.forEntity(CLIENTS_CONFIG),
    EntityEngineModule.forEntity(CONTACTS_CONFIG),
    EntityEngineModule.forEntity(VENDORS_CONFIG),
    EntityEngineModule.forEntity(candidatesConfig),
    EntityEngineModule.forEntity(JOB_OPENINGS_CONFIG),
    EntityEngineModule.forEntity(APPLICATIONS_CONFIG),
    EntityEngineModule.forEntity(INTERVIEWS_CONFIG),
    EntityEngineModule.forEntity(offersConfig),
    EntityEngineModule.forEntity(TASKS_CONFIG),
    OffersModule, // offer approval chain + guard
    ApplicationsModule, // domain-specific automation strategies + seed data
    CandidatesModule, // extras: resume upload, skill tags, sample data seeding
    ClientsModule, // sample data seeding: clients, contacts, vendors, interviews
    JobOpeningsModule, // sample data seeding: job openings, applications
    UsersModule,
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
