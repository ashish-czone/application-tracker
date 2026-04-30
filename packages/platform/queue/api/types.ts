export interface QueueModuleConfig {
  redisUrl: string;
  /**
   * BullMQ keyspace prefix. Falls back to BullMQ's default (`bull`) when
   * unset. Set per app whenever multiple apps share a single Redis
   * instance — without it, every app's Worker registers against the same
   * `bull:<queueName>` keys and races for jobs, silently consuming each
   * other's payloads.
   */
  prefix?: string;
}

export interface JobDefinition<T = unknown> {
  name: string;
  handler: (data: T) => Promise<void>;
}

export interface JobRetentionPolicy {
  /** Max age in seconds before auto-removal */
  age: number;
  /** Max number of jobs to keep */
  count?: number;
}

export interface EnqueueOptions {
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  jobId?: string;
  removeOnComplete?: JobRetentionPolicy | boolean;
  removeOnFail?: JobRetentionPolicy | boolean;
}

/**
 * Options for a recurring (repeating) job schedule.
 *
 * Provide either `every` (fixed millisecond interval) or `pattern` (cron
 * expression) — exactly one. The `schedulerId` is a stable caller-chosen
 * identifier used to identify this schedule for later updates / removal;
 * caller is responsible for namespacing it (e.g. `marketing.poll.<sourceId>`).
 *
 * Each fire of the schedule produces a fresh job whose `attempts`/`backoff`
 * are taken from `jobOptions` (defaulting to single-attempt — recurring jobs
 * usually want their own retry semantics, not BullMQ's default 3).
 */
export interface RecurringJobOptions {
  schedulerId: string;
  every?: number;
  pattern?: string;
  jobOptions?: Pick<EnqueueOptions, 'attempts' | 'backoff' | 'removeOnComplete' | 'removeOnFail'>;
}

export const QUEUE_MODULE_CONFIG = Symbol('QUEUE_MODULE_CONFIG');
