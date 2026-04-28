import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient, KEYS } from './_apiClient';
import type { CreateMilestoneInput } from '../types';

export function useMilestones(projectId: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: KEYS.milestonesFor(projectId),
    queryFn: () => api.listMilestones(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateMilestone(projectId: string) {
  const api = useApiClient();
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
  const api = useApiClient();
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
  const api = useApiClient();
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
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.transitionMilestone(id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.milestonesFor(projectId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}
