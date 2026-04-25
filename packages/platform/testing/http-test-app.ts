import { ValidationPipe, type Type, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { DrizzleDB } from '@packages/database';
import { Test } from '@nestjs/testing';
import { DatabaseModule, DatabaseService } from '@packages/database';
import { LoggerModule } from '@packages/logger';
import { EventsModule } from '@packages/events';
import { RbacModule } from '@packages/rbac';
import { TestExceptionFilter } from './test-exception.filter';
import { MockQueueModule } from './mock-queue.module';
import { MockAutomationsModule } from './mock-automations.module';
import { MockAuthGuard } from './mock-auth.guard';
import { MockRbacGuard } from './mock-rbac.guard';
import { DEFAULT_TEST_USER_ID, seedDefaultTestUser } from './default-test-user';

export interface PackageTestAppOptions {
  /** NestJS modules to import (the module under test + any extra deps) */
  imports?: (Type | DynamicModule)[];
  /** Additional providers to register */
  providers?: any[];
  /** Controllers to register (if not part of imported modules) */
  controllers?: Type[];
  /** Mock modules to include. Defaults to MockQueueModule + MockAutomationsModule. */
  mocks?: {
    queue?: boolean;
    automations?: boolean;
  };
}

export interface PackageTestApp {
  app: INestApplication;
  module: TestingModule;
  db: DrizzleDB;
  httpServer: ReturnType<INestApplication['getHttpServer']>;
  cleanup: () => Promise<void>;
}

/**
 * Creates a production-like NestJS HTTP app for package-level controller integration tests.
 *
 * Includes:
 * - DatabaseModule (real Postgres), LoggerModule, EventsModule, RbacModule
 * - MockQueueModule, MockAutomationsModule (configurable)
 * - MockAuthGuard (reads x-test-user header instead of JWT)
 * - MockRbacGuard (checks permissions from mock user)
 * - ValidationPipe (same config as production: whitelist, forbidNonWhitelisted, transform)
 * - Global prefix: api/v1
 *
 * Usage:
 *   const ctx = await createPackageTestApp({
 *     imports: [TaxonomyModule],
 *   });
 *   await request(ctx.httpServer)
 *     .get('/api/v1/tag-groups')
 *     .set(withAuth(['taxonomy.tag-groups.read']))
 *     .expect(200);
 */
export async function createPackageTestApp(options: PackageTestAppOptions = {}): Promise<PackageTestApp> {
  const { mocks = {} } = options;
  const includeQueue = mocks.queue !== false;
  const includeAutomations = mocks.automations !== false;

  const mockImports: (Type | DynamicModule)[] = [];
  if (includeQueue) mockImports.push(MockQueueModule);
  if (includeAutomations) mockImports.push(MockAutomationsModule);

  const module = await Test.createTestingModule({
    imports: [
      DatabaseModule,
      LoggerModule.register({ provider: 'nestjs' }),
      EventsModule,
      RbacModule,
      ...mockImports,
      ...(options.imports ?? []),
    ],
    controllers: options.controllers ?? [],
    providers: [
      ...(options.providers ?? []),
      { provide: APP_GUARD, useClass: MockAuthGuard },
      { provide: APP_GUARD, useClass: MockRbacGuard },
      { provide: APP_FILTER, useClass: TestExceptionFilter },
    ],
  }).compile();

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

/**
 * Returns headers that MockAuthGuard reads to authenticate a request.
 *
 * Defaults to `DEFAULT_TEST_USER_ID` so the actor is a real row in `users`
 * (seeded by `createPackageTestApp` and the platform-testing
 * `cleanDatabase`). This keeps audit_logs.actor_id FK happy for events
 * emitted by the request. Pass `overrides.userId` to act as a different,
 * pre-inserted user.
 *
 * Usage:
 *   request(httpServer).get('/api/v1/tags').set(withAuth(['taxonomy.tags.read']))
 *   request(httpServer).get('/api/v1/tags').set(withAuth(['*'])) // superadmin
 *   request(httpServer).get('/api/v1/tags').set(withAuth([], { userId: 'specific-id' }))
 */
export function withAuth(
  permissions: string[],
  overrides?: { userId?: string; userType?: string },
): Record<string, string> {
  const permMap: Record<string, boolean> = {};
  for (const p of permissions) permMap[p] = true;

  return {
    'x-test-user': JSON.stringify({
      userId: overrides?.userId ?? DEFAULT_TEST_USER_ID,
      userType: overrides?.userType ?? 'admin',
      permissions: permMap,
    }),
  };
}
