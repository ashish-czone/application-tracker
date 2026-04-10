import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock bullmq before importing QueueService
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  })),
}));

import { QueueService } from '../queue.service';

const mockAppLogger = {
  forContext: vi.fn().mockReturnValue({
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
} as any;

function createQueueService() {
  const originalEnv = process.env.WORKER_ENABLED;
  process.env.WORKER_ENABLED = 'false';

  const service = new QueueService(
    { redisUrl: 'redis://localhost:6379' },
    mockAppLogger,
  );

  process.env.WORKER_ENABLED = originalEnv;
  return service;
}

describe('QueueService.getQueueNames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return an empty array when no queues are registered', () => {
    const service = createQueueService();

    expect(service.getQueueNames()).toEqual([]);
  });

  it('should return names of all registered queues', () => {
    const service = createQueueService();
    service.registerProcessor({ name: 'email', handler: vi.fn() });
    service.registerProcessor({ name: 'notifications', handler: vi.fn() });
    service.registerProcessor({ name: 'reports', handler: vi.fn() });

    const names = service.getQueueNames();

    expect(names).toEqual(['email', 'notifications', 'reports']);
  });

  it('should not include duplicate queue names after re-registration attempt', () => {
    const service = createQueueService();
    service.registerProcessor({ name: 'email', handler: vi.fn() });
    service.registerProcessor({ name: 'email', handler: vi.fn() });

    const names = service.getQueueNames();

    expect(names).toEqual(['email']);
  });
});
