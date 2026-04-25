import { type Type, type DynamicModule } from '@nestjs/common';
import { createIntegrationTestModule } from '@packages/testing';
import { EventsModule } from '@packages/events';
import { RbacModule } from '@packages/rbac';
import { MockQueueModule } from './mock-queue.module';
import { MockAutomationsModule } from './mock-automations.module';
import { seedDefaultTestUser } from './default-test-user';

export interface PlatformTestModuleOptions {
  /** Additional NestJS modules to import (the module under test + any extra deps) */
  imports?: (Type | DynamicModule)[];
  /** Additional providers to register */
  providers?: any[];
  /**
   * Mock modules to include. By default includes MockQueueModule and MockAutomationsModule.
   * Set to false to exclude a mock (e.g., when testing the real module).
   */
  mocks?: {
    queue?: boolean;
    automations?: boolean;
  };
}

/**
 * Creates a NestJS TestingModule for platform package integration tests.
 *
 * Wraps core's `createIntegrationTestModule` and automatically includes:
 * - EventsModule (domain event emitter)
 * - RbacModule (permission registry)
 * - MockQueueModule (no-op QueueService, avoids Redis)
 * - MockAutomationsModule (ActionRegistry, EntityResolverRegistry, UserResolverRegistry)
 *
 * Usage:
 *   const { module, db, cleanup } = await createPlatformTestModule({
 *     imports: [WorkflowsModule],
 *   });
 */
export async function createPlatformTestModule(options: PlatformTestModuleOptions = {}) {
  const { mocks = {} } = options;
  const includeQueue = mocks.queue !== false;
  const includeAutomations = mocks.automations !== false;

  const mockImports: (Type | DynamicModule)[] = [];
  if (includeQueue) mockImports.push(MockQueueModule);
  if (includeAutomations) mockImports.push(MockAutomationsModule);

  const ctx = await createIntegrationTestModule({
    imports: [
      EventsModule,
      RbacModule,
      ...mockImports,
      ...(options.imports ?? []),
    ],
    providers: options.providers ?? [],
  });

  await seedDefaultTestUser(ctx.db);

  return ctx;
}
