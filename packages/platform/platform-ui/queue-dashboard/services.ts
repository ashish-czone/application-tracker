import type { ApiFn } from '../PlatformUIProvider';
import type { QueueSummary, QueueJobsResponse, JobStatus } from './types';

export function createQueueDashboardApi(api: ApiFn) {
  return {
    listQueues(): Promise<QueueSummary[]> {
      return api.get<QueueSummary[]>('/queues');
    },
    listJobs(queueName: string, params: { start?: number; limit?: number; status?: JobStatus }): Promise<QueueJobsResponse> {
      const sp = new URLSearchParams();
      if (params.start != null) sp.set('start', String(params.start));
      if (params.limit != null) sp.set('limit', String(params.limit));
      if (params.status) sp.set('status', params.status);
      const qs = sp.toString();
      return api.get<QueueJobsResponse>(`/queues/${encodeURIComponent(queueName)}/jobs${qs ? `?${qs}` : ''}`);
    },
    pauseQueue(name: string): Promise<void> {
      return api.post<void>(`/queues/${encodeURIComponent(name)}/pause`);
    },
    resumeQueue(name: string): Promise<void> {
      return api.post<void>(`/queues/${encodeURIComponent(name)}/resume`);
    },
    retryAllFailed(name: string): Promise<void> {
      return api.post<void>(`/queues/${encodeURIComponent(name)}/retry-all`);
    },
    cleanJobs(name: string, status: string, grace?: number): Promise<{ removed: number }> {
      return api.post<{ removed: number }>(`/queues/${encodeURIComponent(name)}/clean`, { status, grace });
    },
    retryJob(queueName: string, jobId: string): Promise<void> {
      return api.post<void>(`/queues/${encodeURIComponent(queueName)}/jobs/${jobId}/retry`);
    },
    removeJob(queueName: string, jobId: string): Promise<void> {
      return api.delete<void>(`/queues/${encodeURIComponent(queueName)}/jobs/${jobId}`);
    },
  };
}

export type QueueDashboardApi = ReturnType<typeof createQueueDashboardApi>;
