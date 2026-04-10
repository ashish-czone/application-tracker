import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '../PlatformUIProvider';
import { createQueueDashboardApi } from './services';
import type { JobStatus } from './types';

function useQueueApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createQueueDashboardApi(apiFn), [apiFn]);
}

export function useQueues() {
  const api = useQueueApi();
  return useQuery({
    queryKey: ['queues'],
    queryFn: () => api.listQueues(),
    refetchInterval: 10_000,
  });
}

export function useQueueJobs(queueName: string | null, params: { start?: number; limit?: number; status?: JobStatus }) {
  const api = useQueueApi();
  return useQuery({
    queryKey: ['queues', queueName, 'jobs', params],
    queryFn: () => api.listJobs(queueName!, params),
    enabled: !!queueName,
    refetchInterval: 5_000,
  });
}

export function usePauseQueue() {
  const api = useQueueApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.pauseQueue(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success('Queue paused');
    },
    onError: (err: any) => toast.error(err?.body?.message || 'Failed to pause queue'),
  });
}

export function useResumeQueue() {
  const api = useQueueApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.resumeQueue(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success('Queue resumed');
    },
    onError: (err: any) => toast.error(err?.body?.message || 'Failed to resume queue'),
  });
}

export function useRetryAllFailed() {
  const api = useQueueApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.retryAllFailed(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success('Retrying all failed jobs');
    },
    onError: (err: any) => toast.error(err?.body?.message || 'Failed to retry jobs'),
  });
}

export function useCleanJobs() {
  const api = useQueueApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, status, grace }: { name: string; status: string; grace?: number }) =>
      api.cleanJobs(name, status, grace),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success(`Cleaned ${result.removed} jobs`);
    },
    onError: (err: any) => toast.error(err?.body?.message || 'Failed to clean jobs'),
  });
}

export function useRetryJob() {
  const api = useQueueApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queueName, jobId }: { queueName: string; jobId: string }) =>
      api.retryJob(queueName, jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success('Job retried');
    },
    onError: (err: any) => toast.error(err?.body?.message || 'Failed to retry job'),
  });
}

export function useRemoveJob() {
  const api = useQueueApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queueName, jobId }: { queueName: string; jobId: string }) =>
      api.removeJob(queueName, jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success('Job removed');
    },
    onError: (err: any) => toast.error(err?.body?.message || 'Failed to remove job'),
  });
}
