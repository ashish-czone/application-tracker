import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient, KEYS } from './_apiClient';
import type { CreateTaskInput, TaskStatus } from '../types';

export function useTasks(opts: {
  featureId?: string;
  assigneeId?: string;
  includeDeleted?: boolean;
}) {
  const api = useApiClient();
  const key = opts.featureId
    ? KEYS.tasksFor(opts.featureId)
    : opts.assigneeId
      ? KEYS.tasksByAssignee(opts.assigneeId)
      : (['tasks', 'list', opts] as const);
  return useQuery({ queryKey: key, queryFn: () => api.listTasks(opts) });
}

export function useCreateTask(featureId: string, projectId?: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateTaskInput, 'featureId'>) =>
      api.createTask({ ...input, featureId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.tasksFor(featureId) });
      qc.invalidateQueries({ queryKey: KEYS.myTasks });
      if (projectId) qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}

export function useUpdateTask(featureId: string, projectId?: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateTaskInput> }) =>
      api.updateTask(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.tasksFor(featureId) });
      qc.invalidateQueries({ queryKey: KEYS.myTasks });
      if (projectId) qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}

export function useDeleteTask(featureId: string, projectId?: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.tasksFor(featureId) });
      qc.invalidateQueries({ queryKey: KEYS.myTasks });
      if (projectId) qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}

/**
 * Inline status flip for the tasks datagrid. Invalidates everything that
 * could surface a stale rollup: the task list, My Tasks, project summary,
 * and dashboard. Cheap because each query refetches only when its consumer
 * is mounted.
 */
export function useTransitionTask(featureId: string, projectId?: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: TaskStatus }) => api.transitionTask(id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.tasksFor(featureId) });
      qc.invalidateQueries({ queryKey: KEYS.myTasks });
      if (projectId) qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
      qc.invalidateQueries({ queryKey: KEYS.dashboard });
    },
  });
}
