import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { listTasks, createTask, updateTask, deleteTask, getTaskTransitions, transitionTask } from './services';
import type { ListTasksParams, CreateTaskRequest, UpdateTaskRequest, TransitionRequest } from './types';

export function useTasks(params: ListTasksParams) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => listTasks(params),
  });
}

export function useTaskTransitions(taskId: string | null) {
  return useQuery({
    queryKey: ['task-transitions', taskId],
    queryFn: () => getTaskTransitions(taskId!),
    enabled: !!taskId,
  });
}

export function useCreateTask(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskRequest) => createTask(data),
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskRequest }) => updateTask(id, data),
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransitionRequest }) => transitionTask(id, data),
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
