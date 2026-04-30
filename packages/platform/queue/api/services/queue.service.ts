import { Injectable, Inject, type OnModuleDestroy } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { Queue, Worker, type Job } from 'bullmq';
import type {
  QueueModuleConfig,
  EnqueueOptions,
  JobDefinition,
  RecurringJobOptions,
} from '../types';
import { QUEUE_MODULE_CONFIG } from '../types';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger: ContextLogger;
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private readonly connection: Record<string, unknown>;
  private readonly prefix: string | undefined;
  private workerEnabled: boolean;

  constructor(
    @Inject(QUEUE_MODULE_CONFIG) private readonly config: QueueModuleConfig,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(QueueService.name);
    const url = new URL(this.config.redisUrl);
    this.connection = {
      host: url.hostname,
      port: Number(url.port) || 6379,
      ...(url.password && { password: decodeURIComponent(url.password) }),
      ...(url.username && { username: decodeURIComponent(url.username) }),
      ...(url.pathname && url.pathname.length > 1 && { db: Number(url.pathname.slice(1)) }),
    };
    this.prefix = this.config.prefix;
    this.workerEnabled = process.env.WORKER_ENABLED !== 'false';
  }

  /**
   * Register a named queue with a job processor.
   * If WORKER_ENABLED=true, starts a worker that consumes jobs.
   * If WORKER_ENABLED=false, only creates the queue (for enqueuing from API).
   */
  registerProcessor<T = unknown>(definition: JobDefinition<T>): void {
    const { name, handler } = definition;

    if (this.queues.has(name)) {
      this.logger.warn(`Queue "${name}" is already registered — skipping`);
      return;
    }

    const queue = new Queue(name, { connection: this.connection, ...(this.prefix && { prefix: this.prefix }) });
    this.queues.set(name, queue);

    if (this.workerEnabled) {
      const worker = new Worker(
        name,
        async (job: Job<T>) => {
          this.logger.log('Job started', {
            jobName: name,
            jobId: job.id,
            correlationId: (job.data as Record<string, unknown>)?.correlationId,
            attempt: job.attemptsMade + 1,
          });

          try {
            await handler(job.data);
            this.logger.log('Job completed', {
              jobName: name,
              jobId: job.id,
              correlationId: (job.data as Record<string, unknown>)?.correlationId,
            });
          } catch (error) {
            this.logger.error('Job failed', {
              jobName: name,
              jobId: job.id,
              correlationId: (job.data as Record<string, unknown>)?.correlationId,
              attempt: job.attemptsMade + 1,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        },
        { connection: this.connection, ...(this.prefix && { prefix: this.prefix }) },
      );

      worker.on('error', (err) => {
        this.logger.error('Worker error', { queue: name, error: err.message });
      });

      this.workers.set(name, worker);
      this.logger.log(`Worker started for queue "${name}"`);
    } else {
      this.logger.log(`Queue "${name}" registered (worker disabled — enqueue only)`);
    }
  }

  /**
   * Enqueue a job by queue name.
   */
  async enqueue<T = unknown>(queueName: string, data: T, options?: EnqueueOptions): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" is not registered. Call registerProcessor first.`);
    }

    const SEVEN_DAYS = 7 * 24 * 60 * 60;
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60;

    const job = await queue.add(queueName, data, {
      delay: options?.delay,
      attempts: options?.attempts ?? 3,
      backoff: options?.backoff ?? { type: 'exponential', delay: 1000 },
      jobId: options?.jobId,
      removeOnComplete: options?.removeOnComplete ?? { age: SEVEN_DAYS },
      removeOnFail: options?.removeOnFail ?? { age: FIFTEEN_DAYS },
    });

    this.logger.debug('Job enqueued', {
      queueName,
      jobId: job.id,
      correlationId: (data as Record<string, unknown>)?.correlationId,
    });

    return job.id!;
  }

  /**
   * Schedule a recurring job using a stable scheduler ID.
   *
   * Idempotent: calling this with the same `schedulerId` and identical
   * cadence is a no-op; calling with a changed cadence updates the
   * existing schedule (BullMQ `upsertJobScheduler` semantics).
   *
   * Provide exactly one of `every` (fixed ms interval) or `pattern` (cron
   * expression). The `schedulerId` should be caller-namespaced
   * (e.g. `marketing.poll.<sourceId>`) so multiple consumers don't
   * collide.
   */
  async enqueueRecurring<T = unknown>(
    queueName: string,
    data: T,
    options: RecurringJobOptions,
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" is not registered. Call registerProcessor first.`);
    }

    const hasEvery = typeof options.every === 'number';
    const hasPattern = typeof options.pattern === 'string' && options.pattern.length > 0;
    if (hasEvery === hasPattern) {
      throw new Error(
        `enqueueRecurring requires exactly one of 'every' or 'pattern' (got every=${options.every}, pattern=${options.pattern})`,
      );
    }

    const SEVEN_DAYS = 7 * 24 * 60 * 60;
    const FIFTEEN_DAYS = 15 * 24 * 60 * 60;

    await queue.upsertJobScheduler(
      options.schedulerId,
      hasEvery ? { every: options.every! } : { pattern: options.pattern! },
      {
        name: queueName,
        data,
        opts: {
          attempts: options.jobOptions?.attempts ?? 1,
          backoff: options.jobOptions?.backoff,
          removeOnComplete: options.jobOptions?.removeOnComplete ?? { age: SEVEN_DAYS },
          removeOnFail: options.jobOptions?.removeOnFail ?? { age: FIFTEEN_DAYS },
        },
      },
    );

    this.logger.log('Recurring job upserted', {
      queueName,
      schedulerId: options.schedulerId,
      every: options.every,
      pattern: options.pattern,
    });
  }

  /**
   * Remove a recurring job schedule by its scheduler ID. Returns true if
   * a schedule was removed, false if no schedule existed for that ID.
   */
  async removeRecurring(queueName: string, schedulerId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" is not registered.`);
    }

    const removed = await queue.removeJobScheduler(schedulerId);
    this.logger.log('Recurring job schedule removed', {
      queueName,
      schedulerId,
      removed,
    });
    return removed;
  }

  /**
   * Get a registered queue by name (for advanced operations).
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * Get the names of all registered queues.
   */
  getQueueNames(): string[] {
    return [...this.queues.keys()];
  }

  async onModuleDestroy() {
    const closePromises: Promise<PromiseSettledResult<void>>[] = [];

    for (const [name, worker] of this.workers) {
      this.logger.log(`Closing worker for queue "${name}"`);
      closePromises.push(worker.close().then(() => ({ status: 'fulfilled' as const, value: undefined })).catch((reason) => ({ status: 'rejected' as const, reason })));
    }

    for (const [name, queue] of this.queues) {
      this.logger.log(`Closing queue "${name}"`);
      closePromises.push(queue.close().then(() => ({ status: 'fulfilled' as const, value: undefined })).catch((reason) => ({ status: 'rejected' as const, reason })));
    }

    const results = await Promise.all(closePromises);
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error('Failed to close queue/worker', { error: result.reason?.message ?? String(result.reason) });
      }
    }
  }
}
