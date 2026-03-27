import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '../PlatformUIProvider';
import { createTasksApi } from './services';
import type { ListTasksParams, CreateTaskRequest, UpdateTaskRequest, TransitionRequest } from './types';

function useTasksApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createTasksApi(apiFn), [apiFn]);
}

export function useTasks(params: ListTasksParams) {
  const api = useTasksApi();
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.listTasks(params),
  });
}

export function useTaskTransitions(taskId: string | null) {
  const api = useTasksApi();
  return useQuery({
    queryKey: ['task-transitions', taskId],
    queryFn: () => api.getTaskTransitions(taskId!),
    enabled: !!taskId,
  });
}

export function useCreateTask(options?: { onSuccess?: () => void }) {
  const api = useTasksApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskRequest) => api.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create task');
    },
  });
}

export function useUpdateTask(options?: { onSuccess?: () => void }) {
  const api = useTasksApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskRequest }) => api.updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update task');
    },
  });
}

export function useDeleteTask(options?: { onSuccess?: () => void }) {
  const api = useTasksApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete task');
    },
  });
}

export function useTransitionTask() {
  const api = useTasksApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransitionRequest }) => api.transitionTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-transitions'] });
      toast.success('Status updated');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update status');
    },
  });
}
