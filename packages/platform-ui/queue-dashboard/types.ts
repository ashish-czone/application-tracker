export interface QueueSummary {
  name: string;
  isPaused: boolean;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

export interface QueueJob {
  id: string;
  name: string;
  data: unknown;
  status: string;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  attemptsMade: number;
  failedReason: string | null;
  stacktrace: string[];
  progress: number | string;
  returnvalue: unknown;
}

export interface QueueJobsResponse {
  data: QueueJob[];
  meta: { total: number; start: number; limit: number };
}
