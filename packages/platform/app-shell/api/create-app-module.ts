import { Inject, Injectable, type ModuleMetadata, type OnApplicationBootstrap } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import type { DomainBackendManifest } from '@packages/domains';
import { LoggerModule } from '@packages/logger';
import { DatabaseModule, DatabaseService } from '@packages/database';
import {
  DEBUG_PROFILER_OPTIONS,
  DebugProfilerModule,
  ProfilingContextStore,
  wrapPgPool,
  type DebugProfilerOptions,
} from '@packages/debug-profiler';
import { EventsModule } from '@packages/events';
import { SettingsModule, AppConfigService } from '@packages/settings';
import { QueueModule } from '@packages/queue';
import { AutomationsModule } from '@packages/automations';
import { NotificationsModule } from '@packages/notifications';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { WorkflowsModule } from '@packages/workflows';
import { AuditModule, AuditRegistryService } from '@packages/audit';
import { AUDIT_EXTENSION, EntityEngineModule } from '@packages/entity-engine';
import { MediaModule } from '@packages/media';
import { AuthModule, AuthGuard } from '@packages/auth';
import { RbacGuard } from '@packages/rbac';
import { TaxonomyModule } from '@packages/taxonomy';
import { UserPreferencesModule } from '@packages/user-preferences';
import { HierarchyModule } from '@packages/hierarchy';
import { OrderableModule } from '@packages/orderable';
import { EntityLayoutModule } from '@packages/entity-layout';
import { UsersModule } from '@packages/users';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { ConfigurableThrottlerGuard } from './guards/configurable-throttler.guard';
import { validate } from './env.validation';

export interface AppShellOptions {
  /**
   * Domain manifests this app should host. Each contributes a NestJS module
   * that registers entities, services, and controllers.
   */
  domains: DomainBackendManifest[];
  /**
   * Absolute path to the app's .env file. Each app is responsible for
   * resolving this from its own __dirname.
   */
  envFilePath: string;
  /**
   * Short identifier used in service-auth and logging. e.g. 'recruit'.
   */
  appName: string;
  /**
   * Extra modules to import. App-shell only knows about core/platform modules
   * (per package tier rules). Apps pass any addon modules they need here:
   * NotesModule, AttachmentsModule, OAuthModule, OrgUnitsModule, etc.
   */
  extraImports?: NonNullable<ModuleMetadata['imports']>;
}

@Injectable()
class DebugProfilerPoolBootstrapper implements OnApplicationBootstrap {
  constructor(
    private readonly database: DatabaseService,
    private readonly store: ProfilingContextStore,
    @Inject(DEBUG_PROFILER_OPTIONS) private readonly profilerOptions: DebugProfilerOptions,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.profilerOptions.enabled) return;
    wrapPgPool(this.database.getPool(), this.store);
  }
}

export function createAppModule(options: AppShellOptions): ModuleMetadata {
  return {
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        validate,
        envFilePath: options.envFilePath,
      }),
      LoggerModule.register({ provider: 'pino' }),
      DatabaseModule,
      DebugProfilerModule.forRootAsync({
        useFactory: (config: ConfigService) => ({
          enabled: config.get<string>('DEBUG_PROFILING') === 'true',
        }),
        inject: [ConfigService],
      }),
      EventsModule,
      SettingsModule,
      QueueModule.registerAsync({
        useFactory: (config: ConfigService) => ({
          redisUrl: config.get<string>('REDIS_URL')!,
        }),
        inject: [ConfigService],
      }),
      ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
      MediaModule.registerAsync({
        useFactory: (config: ConfigService) => ({
          provider: (config.get<string>('MEDIA_PROVIDER') ?? 'local') as 'local' | 's3',
          localPath: config.get<string>('MEDIA_LOCAL_PATH') ?? './uploads',
          baseUrl:
            config.get<string>('MEDIA_BASE_URL') ??
            `http://localhost:${config.get<string>('PORT') ?? '3001'}/uploads`,
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
      AutomationsModule,
      NotificationChannelsModule,
      NotificationsModule,
      AuditModule,
      WorkflowsModule,
      HierarchyModule,
      OrderableModule,
      TaxonomyModule,
      UserPreferencesModule,
      EntityLayoutModule,
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
      UsersModule,
      ...(options.extraImports ?? []),
      ...options.domains.map((domain) => domain.module),
    ],
    providers: [
      { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: RbacGuard },
      { provide: APP_GUARD, useClass: ConfigurableThrottlerGuard },
      { provide: AUDIT_EXTENSION, useExisting: AuditRegistryService },
      DebugProfilerPoolBootstrapper,
    ],
  };
}
