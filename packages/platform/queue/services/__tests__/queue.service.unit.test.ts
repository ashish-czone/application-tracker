import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock bullmq before importing QueueService
const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerOn = vi.fn();
let workerConstructorCalls = 0;

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
  Worker: vi.fn().mockImplementation((_name: string, _processor: unknown, _opts: unknown) => {
    workerConstructorCalls++;
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

function createQueueService(workerEnabled = 'true') {
  const originalEnv = process.env.WORKER_ENABLED;
  process.env.WORKER_ENABLED = workerEnabled;

  const service = new QueueService(
    { redisUrl: 'redis://localhost:6379' },
    mockAppLogger,
  );

  process.env.WORKER_ENABLED = originalEnv;
  return service;
}

describe('QueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workerConstructorCalls = 0;
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
