import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock bullmq before importing QueueService
const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockUpsertJobScheduler = vi.fn().mockResolvedValue(undefined);
const mockRemoveJobScheduler = vi.fn().mockResolvedValue(true);
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerOn = vi.fn();
let workerConstructorCalls = 0;
const queueConstructorOpts: unknown[] = [];
const workerConstructorOpts: unknown[] = [];

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation((_name: string, opts: unknown) => {
    queueConstructorOpts.push(opts);
    return {
      add: mockQueueAdd,
      close: mockQueueClose,
      upsertJobScheduler: mockUpsertJobScheduler,
      removeJobScheduler: mockRemoveJobScheduler,
    };
  }),
  Worker: vi.fn().mockImplementation((_name: string, _processor: unknown, opts: unknown) => {
    workerConstructorCalls++;
    workerConstructorOpts.push(opts);
    return {
      close: mockWorkerClose,
      on: mockWorkerOn,
    };
  }),
}));

import { QueueService } from '../queue.service';

const mockContextLogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockAppLogger = {
  forContext: vi.fn().mockReturnValue(mockContextLogger),
} as any;

function createQueueService(workerEnabled = 'true', prefix?: string) {
  const originalEnv = process.env.WORKER_ENABLED;
  process.env.WORKER_ENABLED = workerEnabled;

  const service = new QueueService(
    { redisUrl: 'redis://localhost:6379', prefix },
    mockAppLogger,
  );

  process.env.WORKER_ENABLED = originalEnv;
  return service;
}

describe('QueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workerConstructorCalls = 0;
    queueConstructorOpts.length = 0;
    workerConstructorOpts.length = 0;
  });

  describe('registerProcessor', () => {
    it('should register a queue and create a worker when WORKER_ENABLED=true', () => {
      const service = createQueueService('true');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      // Worker was created — verify via workerConstructorCalls
      expect(workerConstructorCalls).toBe(1);
      // Queue is accessible
      expect(service.getQueue('test.job')).toBeDefined();
    });

    it('should register a queue without a worker when WORKER_ENABLED=false', () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      expect(workerConstructorCalls).toBe(0);
      expect(service.getQueue('test.job')).toBeDefined();
    });

    it('should skip duplicate registration', () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      // Only one queue created — calling getQueue still works
      expect(service.getQueue('test.job')).toBeDefined();
    });

    it('should not pass a prefix to Queue/Worker when config.prefix is unset', () => {
      const service = createQueueService('true');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      expect(queueConstructorOpts).toHaveLength(1);
      expect(queueConstructorOpts[0]).not.toHaveProperty('prefix');
      expect(workerConstructorOpts).toHaveLength(1);
      expect(workerConstructorOpts[0]).not.toHaveProperty('prefix');
    });

    it('should forward config.prefix to Queue and Worker when set', () => {
      const service = createQueueService('true', 'bull:compliance');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      expect(queueConstructorOpts[0]).toMatchObject({ prefix: 'bull:compliance' });
      expect(workerConstructorOpts[0]).toMatchObject({ prefix: 'bull:compliance' });
    });
  });

  describe('enqueue', () => {
    it('should add a job to the registered queue', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      const jobId = await service.enqueue('test.job', { foo: 'bar' });

      expect(jobId).toBe('job-1');
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'test.job',
        { foo: 'bar' },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }),
      );
    });

    it('should throw if queue is not registered', async () => {
      const service = createQueueService('false');

      await expect(service.enqueue('unknown.job', {}))
        .rejects.toThrow('Queue "unknown.job" is not registered');
    });

    it('should apply default retention policies', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      await service.enqueue('test.job', { foo: 'bar' });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'test.job',
        { foo: 'bar' },
        expect.objectContaining({
          removeOnComplete: { age: 7 * 24 * 60 * 60 },
          removeOnFail: { age: 15 * 24 * 60 * 60 },
        }),
      );
    });

    it('should allow overriding retention policies', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      await service.enqueue('test.job', { foo: 'bar' }, {
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail: false,
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'test.job',
        { foo: 'bar' },
        expect.objectContaining({
          removeOnComplete: { age: 3600, count: 100 },
          removeOnFail: false,
        }),
      );
    });

    it('should pass custom options to the job', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      await service.enqueue('test.job', { foo: 'bar' }, {
        delay: 5000,
        attempts: 5,
        jobId: 'custom-id',
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'test.job',
        { foo: 'bar' },
        expect.objectContaining({
          delay: 5000,
          attempts: 5,
          jobId: 'custom-id',
        }),
      );
    });
  });

  describe('enqueueRecurring', () => {
    it('upserts a recurring schedule with `every` cadence', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'poll.reddit', handler: vi.fn() });

      await service.enqueueRecurring(
        'poll.reddit',
        { sourceId: 'src-1' },
        { schedulerId: 'marketing.poll.src-1', every: 15 * 60 * 1000 },
      );

      expect(mockUpsertJobScheduler).toHaveBeenCalledWith(
        'marketing.poll.src-1',
        { every: 15 * 60 * 1000 },
        expect.objectContaining({
          name: 'poll.reddit',
          data: { sourceId: 'src-1' },
          opts: expect.objectContaining({ attempts: 1 }),
        }),
      );
    });

    it('upserts a recurring schedule with cron `pattern` cadence', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'digest.daily', handler: vi.fn() });

      await service.enqueueRecurring(
        'digest.daily',
        { tz: 'UTC' },
        { schedulerId: 'marketing.digest.daily', pattern: '0 8 * * *' },
      );

      expect(mockUpsertJobScheduler).toHaveBeenCalledWith(
        'marketing.digest.daily',
        { pattern: '0 8 * * *' },
        expect.any(Object),
      );
    });

    it('rejects when neither every nor pattern is provided', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'q', handler: vi.fn() });

      await expect(
        service.enqueueRecurring('q', {}, { schedulerId: 's-1' } as any),
      ).rejects.toThrow(/exactly one of 'every' or 'pattern'/);
      expect(mockUpsertJobScheduler).not.toHaveBeenCalled();
    });

    it('rejects when both every and pattern are provided', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'q', handler: vi.fn() });

      await expect(
        service.enqueueRecurring(
          'q',
          {},
          { schedulerId: 's-1', every: 1000, pattern: '* * * * *' },
        ),
      ).rejects.toThrow(/exactly one of 'every' or 'pattern'/);
      expect(mockUpsertJobScheduler).not.toHaveBeenCalled();
    });

    it('throws when the queue is not registered', async () => {
      const service = createQueueService('false');

      await expect(
        service.enqueueRecurring(
          'unknown',
          {},
          { schedulerId: 's-1', every: 1000 },
        ),
      ).rejects.toThrow('Queue "unknown" is not registered');
    });

    it('passes through custom job opts (attempts, backoff, retention)', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'q', handler: vi.fn() });

      await service.enqueueRecurring(
        'q',
        {},
        {
          schedulerId: 's-1',
          every: 60000,
          jobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { age: 3600 },
          },
        },
      );

      expect(mockUpsertJobScheduler).toHaveBeenCalledWith(
        's-1',
        { every: 60000 },
        expect.objectContaining({
          opts: expect.objectContaining({
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { age: 3600 },
          }),
        }),
      );
    });
  });

  describe('removeRecurring', () => {
    it('removes a recurring schedule by ID and returns BullMQ result', async () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'q', handler: vi.fn() });

      const result = await service.removeRecurring('q', 'marketing.poll.src-1');

      expect(result).toBe(true);
      expect(mockRemoveJobScheduler).toHaveBeenCalledWith('marketing.poll.src-1');
    });

    it('returns false when no schedule exists for that ID', async () => {
      mockRemoveJobScheduler.mockResolvedValueOnce(false);
      const service = createQueueService('false');
      service.registerProcessor({ name: 'q', handler: vi.fn() });

      const result = await service.removeRecurring('q', 'nonexistent');
      expect(result).toBe(false);
    });

    it('throws when the queue is not registered', async () => {
      const service = createQueueService('false');

      await expect(service.removeRecurring('unknown', 's-1')).rejects.toThrow(
        'Queue "unknown" is not registered',
      );
    });
  });

  describe('getQueue', () => {
    it('should return the queue instance for a registered queue', () => {
      const service = createQueueService('false');
      service.registerProcessor({ name: 'test.job', handler: vi.fn() });

      expect(service.getQueue('test.job')).toBeDefined();
    });

    it('should return undefined for an unregistered queue', () => {
      const service = createQueueService('false');

      expect(service.getQueue('unknown')).toBeUndefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close all queues and workers', async () => {
      const service = createQueueService('true');
      service.registerProcessor({ name: 'q1', handler: vi.fn() });
      service.registerProcessor({ name: 'q2', handler: vi.fn() });

      await service.onModuleDestroy();

      expect(mockWorkerClose).toHaveBeenCalledTimes(2);
      expect(mockQueueClose).toHaveBeenCalledTimes(2);
    });
  });
});
