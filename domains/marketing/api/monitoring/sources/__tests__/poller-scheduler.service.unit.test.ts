import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PollerSchedulerService } from '../poller-scheduler.service';
import { POLLER_QUEUES, pollerSchedulerId } from '../../pollers/jobs/types';

const mockLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockAppLogger = { forContext: () => mockLogger } as any;

function createService() {
  const queue = {
    enqueueRecurring: vi.fn().mockResolvedValue(undefined),
    removeRecurring: vi.fn().mockResolvedValue(true),
  };

  // Drizzle thenable chain
  const chain: any = {};
  for (const m of ['from', 'where']) chain[m] = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(undefined);

  const database = {
    db: {
      select: vi.fn().mockReturnValue(chain),
    },
    _chain: chain,
  };

  const service = new PollerSchedulerService(queue as any, database as any, mockAppLogger);
  return { service, queue, database };
}

const redditSource = {
  id: 'src-reddit',
  kind: 'reddit',
  isActive: true,
  pollingCadenceMinutes: 15,
} as any;

const inactiveSource = { ...redditSource, isActive: false };

const unknownKindSource = { ...redditSource, kind: 'twitter' };

describe('PollerSchedulerService', () => {
  let s: ReturnType<typeof createService>;

  beforeEach(() => {
    vi.clearAllMocks();
    s = createService();
  });

  describe('upsertSchedule', () => {
    it('enqueues recurring on the kind-specific queue with the right schedulerId and cadence', async () => {
      await s.service.upsertSchedule(redditSource);

      expect(s.queue.enqueueRecurring).toHaveBeenCalledWith(
        POLLER_QUEUES.reddit,
        { sourceId: 'src-reddit' },
        expect.objectContaining({
          schedulerId: pollerSchedulerId('src-reddit'),
          every: 15 * 60 * 1000,
        }),
      );
      expect(s.queue.removeRecurring).not.toHaveBeenCalled();
    });

    it('removes (does NOT schedule) an inactive source — idempotent demotion', async () => {
      await s.service.upsertSchedule(inactiveSource);

      expect(s.queue.enqueueRecurring).not.toHaveBeenCalled();
      expect(s.queue.removeRecurring).toHaveBeenCalledWith(
        POLLER_QUEUES.reddit,
        pollerSchedulerId('src-reddit'),
      );
    });

    it('skips with a warning when the source has an unknown kind', async () => {
      await s.service.upsertSchedule(unknownKindSource);

      expect(s.queue.enqueueRecurring).not.toHaveBeenCalled();
      expect(s.queue.removeRecurring).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Skipping schedule — unknown source kind',
        expect.any(Object),
      );
    });

    it('routes hackernews and rss to their own queues', async () => {
      await s.service.upsertSchedule({ ...redditSource, kind: 'hackernews' });
      expect(s.queue.enqueueRecurring).toHaveBeenLastCalledWith(
        POLLER_QUEUES.hackernews,
        expect.any(Object),
        expect.any(Object),
      );

      await s.service.upsertSchedule({ ...redditSource, kind: 'rss' });
      expect(s.queue.enqueueRecurring).toHaveBeenLastCalledWith(
        POLLER_QUEUES.rss,
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('removeSchedule', () => {
    it('removes the schedule on the matching kind queue', async () => {
      await s.service.removeSchedule('src-reddit', 'reddit');
      expect(s.queue.removeRecurring).toHaveBeenCalledWith(
        POLLER_QUEUES.reddit,
        pollerSchedulerId('src-reddit'),
      );
    });

    it('is a no-op for unknown kinds', async () => {
      await s.service.removeSchedule('src-x', 'twitter');
      expect(s.queue.removeRecurring).not.toHaveBeenCalled();
    });
  });

  describe('onApplicationBootstrap', () => {
    it('reads active sources and upserts a schedule per source', async () => {
      const sources = [
        { id: 'a', kind: 'reddit', isActive: true, pollingCadenceMinutes: 15 },
        { id: 'b', kind: 'hackernews', isActive: true, pollingCadenceMinutes: 30 },
      ];
      // The chain `.where(...)` is the awaited terminus for select-from-where
      // — vitest awaits that promise, so we resolve it with our rows.
      s.database._chain.where.mockResolvedValueOnce(sources);

      await s.service.onApplicationBootstrap();

      expect(s.queue.enqueueRecurring).toHaveBeenCalledTimes(2);
      expect(s.queue.enqueueRecurring).toHaveBeenNthCalledWith(
        1,
        POLLER_QUEUES.reddit,
        { sourceId: 'a' },
        expect.objectContaining({ every: 15 * 60 * 1000 }),
      );
      expect(s.queue.enqueueRecurring).toHaveBeenNthCalledWith(
        2,
        POLLER_QUEUES.hackernews,
        { sourceId: 'b' },
        expect.objectContaining({ every: 30 * 60 * 1000 }),
      );
    });

    it('respects MARKETING_POLLER_BOOTSTRAP=false to skip bootstrap', async () => {
      process.env.MARKETING_POLLER_BOOTSTRAP = 'false';
      try {
        await s.service.onApplicationBootstrap();
        expect(s.database.db.select).not.toHaveBeenCalled();
        expect(s.queue.enqueueRecurring).not.toHaveBeenCalled();
      } finally {
        delete process.env.MARKETING_POLLER_BOOTSTRAP;
      }
    });
  });
});
