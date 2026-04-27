import {
  ValidationPipe,
  type DynamicModule,
  type INestApplication,
  type ModuleMetadata,
  type Type,
} from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { DatabaseModule, DatabaseService } from '@packages/database';
import { LoggerModule } from '@packages/logger';
import { EventsModule } from '@packages/events';
import { RbacModule } from '@packages/rbac';
import { SettingsModule } from '@packages/settings';
import { NotificationChannelsModule } from '@packages/notification-channels';
import { NotificationsModule } from '@packages/notifications';
import { AuditModule, AuditRegistryService } from '@packages/audit';
import { WorkflowsModule } from '@packages/workflows';
import { UserPreferencesModule } from '@packages/user-preferences';
import { EntityLayoutModule } from '@packages/entity-layout';
import { AUDIT_EXTENSION, EntityEngineModule } from '@packages/entity-engine';
import type { DomainBackendManifest } from '@packages/domains';
import { TestExceptionFilter } from './test-exception.filter';
import { MockQueueModule } from './mock-queue.module';
import { MockAutomationsModule } from './mock-automations.module';
import { MockAuthGuard } from './mock-auth.guard';
import { MockRbacGuard } from './mock-rbac.guard';
import { seedDefaultTestUser } from './default-test-user';

export interface TestAppOptions {
  /** Domain manifests to host. Same shape `createAppModule` accepts. */
  domains: DomainBackendManifest[];
  /**
   * Extra modules to import alongside the shell baseline. Apps pass app-level
   * modules here (UsersModule, OrgUnitsModule composition, NotesModule, etc.)
   * exactly like they do at runtime in `createAppModule`'s `extraImports`.
   */
  extraImports?: NonNullable<ModuleMetadata['imports']>;
  /** Additional providers to register on the root test module. */
  providers?: NonNullable<ModuleMetadata['providers']>;
  /** Controllers to register on the root test module. */
  controllers?: Type[];
  /** Mock toggles. Defaults: queue + automations both mocked. */
  mocks?: {
    queue?: boolean;
    automations?: boolean;
  };
}

export interface TestAppContext {
  app: INestApplication;
  module: TestingModule;
  db: DrizzleDB;
  httpServer: ReturnType<INestApplication['getHttpServer']>;
  cleanup: () => Promise<void>;
}

/**
 * Test-mode counterpart of `createAppModule` from `@packages/app-shell`. Composes
 * the same shell modules (DatabaseModule, EventsModule, SettingsModule, RbacModule,
 * NotificationChannels/Notifications, AuditModule, WorkflowsModule,
 * UserPreferencesModule, EntityLayoutModule, EntityEngineModule) plus the
 * caller's domains + `extraImports`, with mocks for queue and automations and the
 * standard mock auth/rbac guards.
 *
 * Differences from runtime composition:
 *  - No `ConfigModule` — env vars (DATABASE_URL etc.) are read raw
 *  - No `ThrottlerModule` — tests don't want rate limiting
 *  - No `MediaModule`, `DebugProfilerModule` — opt-in via extraImports
 *  - No real `AuthModule` — `MockAuthGuard` reads `x-test-user` (use `withAuth`)
 *  - `GlobalExceptionFilter` → `TestExceptionFilter` (mirrors error envelope)
 *
 * Use this when an integration test needs the full shell DI graph (entity-engine
 * tokens, workflow registry, audit pipeline). For testing a single package in
 * isolation, prefer `createPackageTestApp`.
 */
export function createTestAppModule(options: TestAppOptions): ModuleMetadata {
  const { mocks = {} } = options;
  const includeQueue = mocks.queue !== false;
  const includeAutomations = mocks.automations !== false;

  const imports: (Type | DynamicModule)[] = [
    DatabaseModule,
    LoggerModule.register({ provider: 'nestjs' }),
    EventsModule,
    SettingsModule,
    RbacModule,
    NotificationChannelsModule,
    NotificationsModule,
    AuditModule,
    WorkflowsModule,
    UserPreferencesModule,
    EntityLayoutModule,
    EntityEngineModule,
  ];
  if (includeQueue) imports.push(MockQueueModule);
  if (includeAutomations) imports.push(MockAutomationsModule);
  for (const extra of options.extraImports ?? []) imports.push(extra as Type | DynamicModule);
  for (const domain of options.domains) imports.push(domain.module);

  return {
    imports,
    controllers: options.controllers ?? [],
    providers: [
      ...(options.providers ?? []),
      { provide: APP_GUARD, useClass: MockAuthGuard },
      { provide: APP_GUARD, useClass: MockRbacGuard },
      { provide: APP_FILTER, useClass: TestExceptionFilter },
      { provide: AUDIT_EXTENSION, useExisting: AuditRegistryService },
    ],
  };
}

/**
 * Boots an HTTP test app from `createTestAppModule`. Returns the same shape as
 * `createPackageTestApp` so test setups are interchangeable. Seeds the default
 * test user so audit-log FK constraints hold for events emitted by mock-auth'd
 * requests.
 */
export async function createTestApp(options: TestAppOptions): Promise<TestAppContext> {
  const moduleMetadata = createTestAppModule(options);
  const module = await Test.createTestingModule(moduleMetadata).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const database = module.get(DatabaseService);
  await seedDefaultTestUser(database.db);

  return {
    app,
    module,
    db: database.db,
    httpServer: app.getHttpServer(),
    async cleanup() {
      await app.close();
    },
  };
}
