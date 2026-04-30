import {
  cleanDatabase,
  createTestApp,
  type TestAppContext,
} from '@packages/platform-testing';
import { marketingBackend } from '../../index';
import { PollerSchedulerService } from '../../monitoring/sources/poller-scheduler.service';

/**
 * Mock scheduler used in integration tests. Replaces the real
 * PollerSchedulerService so source create/update/delete don't try to call
 * the queue addon's enqueueRecurring (which the platform-testing
 * MockQueueModule doesn't expose). Integration tests focus on controller
 * + service behaviour; the scheduler's own unit tests cover its contract.
 */
const mockScheduler = {
  upsertSchedule: async () => {},
  removeSchedule: async () => {},
  onApplicationBootstrap: async () => {},
};

/**
 * Boots a NestJS HTTP test app with the marketing domain wired up against
 * real Postgres. The poller scheduler bootstrap is disabled and the
 * scheduler service itself is replaced with a no-op mock so the queue
 * surface isn't exercised here.
 */
export async function createMarketingTestApp(): Promise<TestAppContext> {
  process.env.MARKETING_POLLER_BOOTSTRAP = 'false';
  const ctx = await createTestApp({
    domains: [marketingBackend],
  });

  // Override the real scheduler. We can't pass providers through createTestApp
  // (it builds the module then compiles), but the TestingModule on ctx exposes
  // overrideProvider for exactly this case — except by then the app is already
  // initialised. The simplest workaround is to mutate the singleton in-place
  // post-init: the scheduler is property-injected into MonitoringSourcesService
  // and never recreated. See `replaceScheduler` below.
  replaceSchedulerWithMock(ctx);
  return ctx;
}

function replaceSchedulerWithMock(ctx: TestAppContext): void {
  const scheduler = ctx.module.get(PollerSchedulerService, { strict: false });
  if (!scheduler) return;
  Object.assign(scheduler, mockScheduler);
}

/**
 * Truncates every table between tests. Marketing has no per-app seed step
 * (no entity-engine field defs, no workflow rows) so this is a single
 * call.
 */
export async function resetMarketingTestDb(ctx: TestAppContext): Promise<void> {
  await cleanDatabase(ctx.db);
}
