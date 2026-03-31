import { Injectable, Inject, type OnModuleDestroy } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { Queue, Worker, type Job } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { QueueModuleConfig, EnqueueOptions, JobDefinition } from '../types';
import { QUEUE_MODULE_CONFIG } from '../types';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger: ContextLogger;
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private readonly connection: Record<string, unknown>;
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

    const queue = new Queue(name, { connection: this.connection });
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
        { connection: this.connection },
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

    const job = await queue.add(queueName, data, {
      delay: options?.delay,
      attempts: options?.attempts ?? 3,
      backoff: options?.backoff ?? { type: 'exponential', delay: 1000 },
      jobId: options?.jobId,
    });

    this.logger.debug('Job enqueued', {
      queueName,
      jobId: job.id,
      correlationId: (data as Record<string, unknown>)?.correlationId,
    });

    return job.id!;
  }

  /**
   * Get a registered queue by name (for advanced operations).
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  /**
   * Create an Express router for the Bull Board UI.
   * Mount this on an Express app to expose the queue dashboard.
   */
  createBullBoardRouter(basePath: string) {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath(basePath);

    createBullBoard({
      queues: [...this.queues.values()].map((q) => new BullMQAdapter(q)),
      serverAdapter,
    });

    return serverAdapter.getRouter();
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
