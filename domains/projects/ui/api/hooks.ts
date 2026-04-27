import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlatformAPI } from '@packages/platform-ui';
import { createProjectsApi } from './services';
import type {
  CreateFeatureInput,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateTaskInput,
  TaskStatus,
} from '../types';

function useProjectsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createProjectsApi(apiFn), [apiFn]);
}

const KEYS = {
  dashboard: ['projects', 'dashboard'] as const,
  summary: (id: string | undefined) => ['projects', 'summary', id] as const,
  project: (id: string | undefined) => ['projects', 'detail', id] as const,
  projectsList: (filters: object) => ['projects', 'list', filters] as const,
  milestonesFor: (projectId: string | undefined) => ['milestones', 'for-project', projectId] as const,
  featuresFor: (milestoneId: string | undefined) => ['features', 'for-milestone', milestoneId] as const,
  tasksFor: (featureId: string | undefined) => ['tasks', 'for-feature', featureId] as const,
  tasksByAssignee: (userId: string | undefined) => ['tasks', 'by-assignee', userId] as const,
  myTasks: ['tasks', 'mine'] as const,
};

// ---- Dashboard / Summary ----

export function useProjectsDashboard() {
  const api = useProjectsApi();
  return useQuery({ queryKey: KEYS.dashboard, queryFn: () => api.listDashboard() });
}

export function useProjectSummary(id: string | undefined) {
  const api = useProjectsApi();
  return useQuery({
    queryKey: KEYS.summary(id),
    queryFn: () => api.getProjectSummary(id!),
    enabled: !!id,
  });
}

// ---- Projects ----

export function useProjects(filters: { search?: string; status?: string; includeDeleted?: boolean } = {}) {
  const api = useProjectsApi();
  return useQuery({
    queryKey: KEYS.projectsList(filters),
    queryFn: () => api.listProjects(filters),
  });
}

export function useProject(id: string | undefined) {
  const api = useProjectsApi();
  return useQuery({
    queryKey: KEYS.project(id),
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.createProject(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateProjectInput>) => api.updateProject(projectId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject() {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useTransitionProject(projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (to: string) => api.transitionProject(projectId, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// ---- Milestones ----

export function useMilestones(projectId: string | undefined) {
  const api = useProjectsApi();
  return useQuery({
    queryKey: KEYS.milestonesFor(projectId),
    queryFn: () => api.listMilestones(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateMilestone(projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateMilestoneInput, 'projectId'>) =>
      api.createMilestone({ ...input, projectId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.milestonesFor(projectId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}

export function useUpdateMilestone(projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateMilestoneInput> }) =>
      api.updateMilestone(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.milestonesFor(projectId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}

export function useDeleteMilestone(projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMilestone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.milestonesFor(projectId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}

export function useTransitionMilestone(projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.transitionMilestone(id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.milestonesFor(projectId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}

// ---- Features ----

export function useFeatures(milestoneId: string | undefined) {
  const api = useProjectsApi();
  return useQuery({
    queryKey: KEYS.featuresFor(milestoneId),
    queryFn: () => api.listFeatures(milestoneId!),
    enabled: !!milestoneId,
  });
}

export function useCreateFeature(milestoneId: string, projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateFeatureInput, 'milestoneId'>) =>
      api.createFeature({ ...input, milestoneId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.featuresFor(milestoneId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}

export function useUpdateFeature(milestoneId: string, projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateFeatureInput> }) =>
      api.updateFeature(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.featuresFor(milestoneId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}

export function useDeleteFeature(milestoneId: string, projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteFeature(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.featuresFor(milestoneId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}

export function useTransitionFeature(milestoneId: string, projectId: string) {
  const api = useProjectsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.transitionFeature(id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.featuresFor(milestoneId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}

// ---- Tasks ----

export function useTasks(opts: { featureId?: string; assigneeId?: string; includeDeleted?: boolean }) {
  const api = useProjectsApi();
  const key = opts.featureId
    ? KEYS.tasksFor(opts.featureId)
    : opts.assigneeId
      ? KEYS.tasksByAssignee(opts.assigneeId)
      : ['tasks', 'list', opts] as const;
  return useQuery({ queryKey: key, queryFn: () => api.listTasks(opts) });
}

export function useMyTasks() {
  const api = useProjectsApi();
  return useQuery({ queryKey: KEYS.myTasks, queryFn: () => api.listMyTasks() });
}

export function useCreateTask(featureId: string, projectId?: string) {
  const api = useProjectsApi();
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
  const api = useProjectsApi();
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
  const api = useProjectsApi();
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
  const api = useProjectsApi();
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

/**
 * Same as `useTransitionTask` but doesn't require a feature id — used by
 * the My Tasks page where the row already carries its project context.
 */
export function useTransitionTaskFromMyList() {
  const api = useProjectsApi();
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
