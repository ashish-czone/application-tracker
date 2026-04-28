import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient, KEYS } from './_apiClient';
import type { CreateProjectInput } from '../types';

export function useProjectsDashboard() {
  const api = useApiClient();
  return useQuery({ queryKey: KEYS.dashboard, queryFn: () => api.listDashboard() });
}

export function useProjectSummary(id: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: KEYS.summary(id),
    queryFn: () => api.getProjectSummary(id!),
    enabled: !!id,
  });
}

export function useProjects(
  filters: { search?: string; status?: string; includeDeleted?: boolean } = {},
) {
  const api = useApiClient();
  return useQuery({
    queryKey: KEYS.projectsList(filters),
    queryFn: () => api.listProjects(filters),
  });
}

export function useProject(id: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: KEYS.project(id),
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.createProject(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject(projectId: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateProjectInput>) => api.updateProject(projectId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject() {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useTransitionProject(projectId: string) {
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (to: string) => api.transitionProject(projectId, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
