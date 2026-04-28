import { useMemo } from 'react';
import { usePlatformAPI } from '@packages/platform-ui';
import { createProjectsApi } from '../api/services';

export function useApiClient() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createProjectsApi(apiFn), [apiFn]);
}

export const KEYS = {
  dashboard: ['projects', 'dashboard'] as const,
  summary: (id: string | undefined) => ['projects', 'summary', id] as const,
  project: (id: string | undefined) => ['projects', 'detail', id] as const,
  projectsList: (filters: object) => ['projects', 'list', filters] as const,
  milestonesFor: (projectId: string | undefined) =>
    ['milestones', 'for-project', projectId] as const,
  featuresFor: (milestoneId: string | undefined) =>
    ['features', 'for-milestone', milestoneId] as const,
  tasksFor: (featureId: string | undefined) => ['tasks', 'for-feature', featureId] as const,
  tasksByAssignee: (userId: string | undefined) => ['tasks', 'by-assignee', userId] as const,
  myTasks: ['tasks', 'mine'] as const,
};
