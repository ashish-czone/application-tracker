import { Test, type TestingModule } from '@nestjs/testing';
import { type Type, type DynamicModule } from '@nestjs/common';
import { DatabaseModule, DatabaseService } from '@packages/database';
import { LoggerModule } from '@packages/logger';

export interface IntegrationTestModuleOptions {
  imports?: (Type | DynamicModule)[];
  providers?: any[];
}

/**
 * Creates a minimal NestJS TestingModule for integration tests.
 *
 * Automatically includes DatabaseModule (real Postgres) and LoggerModule.
 * Callers add only the modules they need to test.
 *
 * Usage:
 *   const { module, db, cleanup } = await createIntegrationTestModule({
 *     imports: [SettingsModule, RbacModule],
 *   });
 */
export async function createIntegrationTestModule(options: IntegrationTestModuleOptions) {
  const module = await Test.createTestingModule({
    imports: [
      DatabaseModule,
      LoggerModule.register({ provider: 'nestjs' }),
      ...(options.imports ?? []),
    ],
    providers: options.providers ?? [],
  }).compile();

  await module.init();

  const database = module.get(DatabaseService);

  return {
    module,
    db: database.db,
    async cleanup() {
      await module.close();
    },
  };
}
