export interface QueueModuleConfig {
  redisUrl: string;
}

export interface JobDefinition<T = unknown> {
  name: string;
  handler: (data: T) => Promise<void>;
}

export interface JobRetentionPolicy {
  /** Max age in seconds before auto-removal */
  age?: number;
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
