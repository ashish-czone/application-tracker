export interface QueueModuleConfig {
  redisUrl: string;
}

export interface JobDefinition<T = unknown> {
  name: string;
  handler: (data: T) => Promise<void>;
}

export interface EnqueueOptions {
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  jobId?: string;
}

export const QUEUE_MODULE_CONFIG = Symbol('QUEUE_MODULE_CONFIG');
