import { Injectable, Inject, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type Job } from 'bullmq';
import type { QueueModuleConfig, EnqueueOptions, JobDefinition } from '../types';
import { QUEUE_MODULE_CONFIG } from '../types';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private readonly connection: Record<string, unknown>;
  private workerEnabled: boolean;

  constructor(
    @Inject(QUEUE_MODULE_CONFIG) private readonly config: QueueModuleConfig,
  ) {
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
          this.logger.log({
            jobName: name,
            jobId: job.id,
            correlationId: (job.data as Record<string, unknown>)?.correlationId,
            attempt: job.attemptsMade + 1,
          }, 'Job started');

          try {
            await handler(job.data);
            this.logger.log({
              jobName: name,
              jobId: job.id,
              correlationId: (job.data as Record<string, unknown>)?.correlationId,
            }, 'Job completed');
          } catch (error) {
            this.logger.error({
              jobName: name,
              jobId: job.id,
              correlationId: (job.data as Record<string, unknown>)?.correlationId,
              attempt: job.attemptsMade + 1,
              error: error instanceof Error ? error.message : String(error),
            }, 'Job failed');
            throw error;
          }
        },
        { connection: this.connection },
      );

      worker.on('error', (err) => {
        this.logger.error({ queue: name, error: err.message }, 'Worker error');
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

    this.logger.debug({
      queueName,
      jobId: job.id,
      correlationId: (data as Record<string, unknown>)?.correlationId,
    }, 'Job enqueued');

    return job.id!;
  }

  /**
   * Get a registered queue by name (for advanced operations).
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
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
        this.logger.error({ error: result.reason?.message ?? String(result.reason) }, 'Failed to close queue/worker');
      }
    }
  }
}
