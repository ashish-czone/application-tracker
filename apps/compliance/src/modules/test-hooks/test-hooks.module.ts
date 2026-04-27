import { Module, type DynamicModule } from '@nestjs/common';
import { TestHooksController } from './test-hooks.controller';
import { TestHooksService } from './test-hooks.service';

/**
 * Test-hooks reset endpoint, gated by ENABLE_TEST_HOOKS=true.
 *
 * Positive opt-in (not `NODE_ENV !== 'production'`) so an unset env
 * fails closed: previews / staging do not accidentally expose a
 * destructive reset endpoint just because they are not labelled prod.
 *
 * When the flag is unset the module registers no controllers or
 * providers, so the route does not exist and the dependency tree is
 * unchanged from a normal app boot.
 */
@Module({})
export class TestHooksModule {
  static register(): DynamicModule {
    if (process.env.ENABLE_TEST_HOOKS !== 'true') {
      return { module: TestHooksModule };
    }
    return {
      module: TestHooksModule,
      controllers: [TestHooksController],
      providers: [TestHooksService],
    };
  }
}
