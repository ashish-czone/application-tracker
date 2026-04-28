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

export const QUEUE_MODULE_CONFIG = Symbol('QUEUE_MODULE_CONFIG');
