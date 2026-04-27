import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
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

  /**
   * Run the compliance filings generator at a deterministic instant. The
   * service iterates every active rule × active registration, materialising
   * filings whose periodStart falls within the 12-month horizon ending at
   * `asOf`. Use to assert US-6.x rolling-horizon behaviour without waiting
   * for wall-clock time.
   */
  @Post('cron/generator/run')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('*')
  async runGenerator(@Body() body: { asOf?: string }) {
    const asOf = parseAsOf(body?.asOf);
    const result = await this.testHooksService.runGenerator(asOf);
    return { ok: true, asOf: asOf.toISOString(), ...result };
  }

  /**
   * Run the automations schedule scanner at a deterministic instant. Drives
   * the rule-based time-driven flows (T+0/T+3/T+7 escalation, daily digest)
   * end-to-end: the scanner's hour-of-day and date-condition checks honour
   * `asOf`, and the resulting ActionContext carries `now=asOf` so action
   * handlers (digest etc.) bucket their queries against the injected date.
   */
  @Post('cron/scheduler/run')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('*')
  async runScheduler(@Body() body: { asOf?: string }) {
    const asOf = parseAsOf(body?.asOf);
    const result = await this.testHooksService.runScheduler(asOf);
    return { ok: true, asOf: asOf.toISOString(), ...result };
  }
}

function parseAsOf(input: string | undefined): Date {
  if (!input) {
    throw new BadRequestException('asOf is required (ISO 8601 timestamp)');
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`asOf is not a valid ISO 8601 timestamp: ${input}`);
  }
  return parsed;
}
