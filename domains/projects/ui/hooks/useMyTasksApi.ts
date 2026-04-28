import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient, KEYS } from './_apiClient';
import type { TaskStatus } from '../types';

export function useMyTasks() {
  const api = useApiClient();
  return useQuery({ queryKey: KEYS.myTasks, queryFn: () => api.listMyTasks() });
}

/**
 * Status flip from the My Tasks page. Different from `useTransitionTask` in
 * that it doesn't require a feature id — the row already carries its
 * project context, so we invalidate broadly across `projects` and `tasks`.
 */
export function useTransitionTaskFromMyList() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: TaskStatus }) => api.transitionTask(id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.myTasks });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
