import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RequirePermission } from '@packages/rbac';
import { TestHooksService } from './test-hooks.service';

/**
 * Test-only endpoints. Mounted only when ENABLE_TEST_HOOKS=true (see
 * test-hooks.module). The route is super-admin-gated as a defence in
 * depth: even in a misconfigured non-prod env, only the e2e-admin
 * super-admin can hit it.
 */
@Controller('admin/test')
export class TestHooksController {
  constructor(private readonly testHooksService: TestHooksService) {}

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('*')
  async reset() {
    const result = await this.testHooksService.resetState();
    return { ok: true, ...result };
  }
}
