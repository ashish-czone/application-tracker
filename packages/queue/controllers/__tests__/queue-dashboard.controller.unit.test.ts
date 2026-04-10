import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { QueueDashboardController } from '../queue-dashboard.controller';

const mockQueue = {
  getJobCounts: vi.fn(),
  isPaused: vi.fn(),
  getJobs: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  clean: vi.fn(),
  retryJobs: vi.fn(),
  getJob: vi.fn(),
};

const mockQueueService = {
  getQueueNames: vi.fn(),
  getQueue: vi.fn(),
};

function createMockJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    name: 'test',
    data: { foo: 'bar' },
    timestamp: 1700000000000,
    processedOn: null,
    finishedOn: null,
    attemptsMade: 0,
    failedReason: null,
    stacktrace: [],
    progress: 0,
    returnvalue: null,
    getState: vi.fn().mockResolvedValue('waiting'),
    retry: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('QueueDashboardController', () => {
  let controller: QueueDashboardController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new QueueDashboardController(mockQueueService as any);
  });

  describe('listQueues', () => {
    it('should return an empty array when no queues are registered', async () => {
      mockQueueService.getQueueNames.mockReturnValue([]);

      const result = await controller.listQueues();

      expect(result).toEqual([]);
      expect(mockQueueService.getQueueNames).toHaveBeenCalled();
    });

    it('should return queue info with counts and paused status', async () => {
      mockQueueService.getQueueNames.mockReturnValue(['email', 'notifications']);
      mockQueueService.getQueue.mockReturnValue(mockQueue);

      mockQueue.getJobCounts
        .mockResolvedValueOnce({ waiting: 5, active: 2, completed: 10, failed: 1, delayed: 0 })
        .mockResolvedValueOnce({ waiting: 0, active: 0, completed: 3, failed: 0, delayed: 1 });
      mockQueue.isPaused
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await controller.listQueues();

      expect(result).toEqual([
        {
          name: 'email',
          isPaused: false,
          counts: { waiting: 5, active: 2, completed: 10, failed: 1, delayed: 0 },
        },
        {
          name: 'notifications',
          isPaused: true,
          counts: { waiting: 0, active: 0, completed: 3, failed: 0, delayed: 1 },
        },
      ]);
    });

    it('should call getQueue for each queue name', async () => {
      mockQueueService.getQueueNames.mockReturnValue(['q1', 'q2', 'q3']);
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.getJobCounts.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });
      mockQueue.isPaused.mockResolvedValue(false);

      await controller.listQueues();

      expect(mockQueueService.getQueue).toHaveBeenCalledTimes(3);
      expect(mockQueueService.getQueue).toHaveBeenCalledWith('q1');
      expect(mockQueueService.getQueue).toHaveBeenCalledWith('q2');
      expect(mockQueueService.getQueue).toHaveBeenCalledWith('q3');
    });
  });

  describe('listJobs', () => {
    it('should throw NotFoundException when queue is not found', async () => {
      mockQueueService.getQueue.mockReturnValue(undefined);

      await expect(controller.listJobs('unknown', {} as any))
        .rejects.toThrow(NotFoundException);
      await expect(controller.listJobs('unknown', {} as any))
        .rejects.toThrow('Queue "unknown" not found');
    });

    it('should return jobs with default pagination', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      const job = createMockJob();
      mockQueue.getJobs.mockResolvedValue([job]);
      job.getState.mockResolvedValue('waiting');
      mockQueue.getJobCounts.mockResolvedValue({ waiting: 1, active: 0, completed: 0, failed: 0, delayed: 0 });

      const result = await controller.listJobs('email', { start: 0, limit: 25 } as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'job-1',
        name: 'test',
        data: { foo: 'bar' },
        status: 'waiting',
        timestamp: 1700000000000,
        processedOn: null,
        finishedOn: null,
        attemptsMade: 0,
        failedReason: null,
        stacktrace: [],
        progress: 0,
        returnvalue: null,
      });
      expect(result.meta).toEqual({ total: 1, start: 0, limit: 25 });
    });

    it('should pass all status types when no status filter is given', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.getJobs.mockResolvedValue([]);
      mockQueue.getJobCounts.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });

      await controller.listJobs('email', { start: 0, limit: 25 } as any);

      expect(mockQueue.getJobs).toHaveBeenCalledWith(
        ['waiting', 'active', 'completed', 'failed', 'delayed'],
        0,
        24,
        false,
      );
      expect(mockQueue.getJobCounts).toHaveBeenCalledWith(
        'waiting', 'active', 'completed', 'failed', 'delayed',
      );
    });

    it('should filter by status when status filter is provided', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.getJobs.mockResolvedValue([]);
      mockQueue.getJobCounts.mockResolvedValue({ failed: 3 });

      await controller.listJobs('email', { status: 'failed', start: 0, limit: 25 } as any);

      expect(mockQueue.getJobs).toHaveBeenCalledWith(['failed'], 0, 24, false);
      expect(mockQueue.getJobCounts).toHaveBeenCalledWith('failed');
    });

    it('should apply custom pagination parameters', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.getJobs.mockResolvedValue([]);
      mockQueue.getJobCounts.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });

      await controller.listJobs('email', { start: 10, limit: 5 } as any);

      expect(mockQueue.getJobs).toHaveBeenCalledWith(
        ['waiting', 'active', 'completed', 'failed', 'delayed'],
        10,
        14,
        false,
      );
      expect(result => result.meta).toBeDefined();
    });

    it('should correctly compute total from counts', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.getJobs.mockResolvedValue([]);
      mockQueue.getJobCounts.mockResolvedValue({ waiting: 10, active: 5, completed: 20, failed: 3, delayed: 2 });

      const result = await controller.listJobs('email', { start: 0, limit: 25 } as any);

      expect(result.meta.total).toBe(40);
    });

    it('should serialize job with all fields correctly', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      const job = createMockJob({
        id: 'job-42',
        name: 'send-email',
        data: { to: 'user@example.com' },
        timestamp: 1700000000000,
        processedOn: 1700000001000,
        finishedOn: 1700000002000,
        attemptsMade: 2,
        failedReason: 'timeout',
        stacktrace: ['Error: timeout\n  at ...'],
        progress: 50,
        returnvalue: { sent: true },
      });
      job.getState.mockResolvedValue('completed');
      mockQueue.getJobs.mockResolvedValue([job]);
      mockQueue.getJobCounts.mockResolvedValue({ completed: 1 });

      const result = await controller.listJobs('email', { status: 'completed', start: 0, limit: 25 } as any);

      expect(result.data[0]).toEqual({
        id: 'job-42',
        name: 'send-email',
        data: { to: 'user@example.com' },
        status: 'completed',
        timestamp: 1700000000000,
        processedOn: 1700000001000,
        finishedOn: 1700000002000,
        attemptsMade: 2,
        failedReason: 'timeout',
        stacktrace: ['Error: timeout\n  at ...'],
        progress: 50,
        returnvalue: { sent: true },
      });
    });

    it('should use defaults when start and limit are undefined', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.getJobs.mockResolvedValue([]);
      mockQueue.getJobCounts.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });

      const result = await controller.listJobs('email', {} as any);

      expect(mockQueue.getJobs).toHaveBeenCalledWith(
        ['waiting', 'active', 'completed', 'failed', 'delayed'],
        0,
        24,
        false,
      );
      expect(result.meta).toEqual({ total: 0, start: 0, limit: 25 });
    });

    it('should resolve states for multiple jobs', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      const job1 = createMockJob({ id: 'j1' });
      const job2 = createMockJob({ id: 'j2' });
      job1.getState.mockResolvedValue('waiting');
      job2.getState.mockResolvedValue('active');
      mockQueue.getJobs.mockResolvedValue([job1, job2]);
      mockQueue.getJobCounts.mockResolvedValue({ waiting: 1, active: 1, completed: 0, failed: 0, delayed: 0 });

      const result = await controller.listJobs('email', { start: 0, limit: 25 } as any);

      expect(result.data[0].status).toBe('waiting');
      expect(result.data[1].status).toBe('active');
    });
  });

  describe('pauseQueue', () => {
    it('should throw NotFoundException when queue is not found', async () => {
      mockQueueService.getQueue.mockReturnValue(undefined);

      await expect(controller.pauseQueue('unknown'))
        .rejects.toThrow(NotFoundException);
    });

    it('should pause the queue', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.pause.mockResolvedValue(undefined);

      await controller.pauseQueue('email');

      expect(mockQueueService.getQueue).toHaveBeenCalledWith('email');
      expect(mockQueue.pause).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('should throw NotFoundException when queue is not found', async () => {
      mockQueueService.getQueue.mockReturnValue(undefined);

      await expect(controller.resumeQueue('unknown'))
        .rejects.toThrow(NotFoundException);
    });

    it('should resume the queue', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.resume.mockResolvedValue(undefined);

      await controller.resumeQueue('email');

      expect(mockQueueService.getQueue).toHaveBeenCalledWith('email');
      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('cleanJobs', () => {
    it('should throw NotFoundException when queue is not found', async () => {
      mockQueueService.getQueue.mockReturnValue(undefined);

      await expect(controller.cleanJobs('unknown', { status: 'completed' } as any))
        .rejects.toThrow(NotFoundException);
    });

    it('should clean jobs with default grace period', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.clean.mockResolvedValue(['j1', 'j2', 'j3']);

      const result = await controller.cleanJobs('email', { status: 'completed' } as any);

      expect(mockQueue.clean).toHaveBeenCalledWith(0, 1000, 'completed');
      expect(result).toEqual({ removed: 3 });
    });

    it('should clean jobs with custom grace period', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.clean.mockResolvedValue(['j1']);

      const result = await controller.cleanJobs('email', { status: 'failed', grace: 5000 } as any);

      expect(mockQueue.clean).toHaveBeenCalledWith(5000, 1000, 'failed');
      expect(result).toEqual({ removed: 1 });
    });

    it('should return zero removed when no jobs cleaned', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.clean.mockResolvedValue([]);

      const result = await controller.cleanJobs('email', { status: 'completed' } as any);

      expect(result).toEqual({ removed: 0 });
    });
  });

  describe('retryAll', () => {
    it('should throw NotFoundException when queue is not found', async () => {
      mockQueueService.getQueue.mockReturnValue(undefined);

      await expect(controller.retryAll('unknown'))
        .rejects.toThrow(NotFoundException);
    });

    it('should retry all jobs in the queue', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.retryJobs.mockResolvedValue(undefined);

      await controller.retryAll('email');

      expect(mockQueueService.getQueue).toHaveBeenCalledWith('email');
      expect(mockQueue.retryJobs).toHaveBeenCalled();
    });
  });

  describe('retryJob', () => {
    it('should throw NotFoundException when queue is not found', async () => {
      mockQueueService.getQueue.mockReturnValue(undefined);

      await expect(controller.retryJob('unknown', 'job-1'))
        .rejects.toThrow(NotFoundException);
      await expect(controller.retryJob('unknown', 'job-1'))
        .rejects.toThrow('Queue "unknown" not found');
    });

    it('should throw NotFoundException when job is not found', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.getJob.mockResolvedValue(null);

      await expect(controller.retryJob('email', 'missing-job'))
        .rejects.toThrow(NotFoundException);
      await expect(controller.retryJob('email', 'missing-job'))
        .rejects.toThrow('Job "missing-job" not found');
    });

    it('should retry the specified job', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      const job = createMockJob();
      mockQueue.getJob.mockResolvedValue(job);

      await controller.retryJob('email', 'job-1');

      expect(mockQueueService.getQueue).toHaveBeenCalledWith('email');
      expect(mockQueue.getJob).toHaveBeenCalledWith('job-1');
      expect(job.retry).toHaveBeenCalled();
    });
  });

  describe('removeJob', () => {
    it('should throw NotFoundException when queue is not found', async () => {
      mockQueueService.getQueue.mockReturnValue(undefined);

      await expect(controller.removeJob('unknown', 'job-1'))
        .rejects.toThrow(NotFoundException);
      await expect(controller.removeJob('unknown', 'job-1'))
        .rejects.toThrow('Queue "unknown" not found');
    });

    it('should throw NotFoundException when job is not found', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      mockQueue.getJob.mockResolvedValue(null);

      await expect(controller.removeJob('email', 'missing-job'))
        .rejects.toThrow(NotFoundException);
      await expect(controller.removeJob('email', 'missing-job'))
        .rejects.toThrow('Job "missing-job" not found');
    });

    it('should remove the specified job', async () => {
      mockQueueService.getQueue.mockReturnValue(mockQueue);
      const job = createMockJob();
      mockQueue.getJob.mockResolvedValue(job);

      await controller.removeJob('email', 'job-1');

      expect(mockQueueService.getQueue).toHaveBeenCalledWith('email');
      expect(mockQueue.getJob).toHaveBeenCalledWith('job-1');
      expect(job.remove).toHaveBeenCalled();
    });
  });
});
