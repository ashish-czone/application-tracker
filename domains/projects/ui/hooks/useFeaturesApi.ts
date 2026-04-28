import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient, KEYS } from './_apiClient';
import type { CreateFeatureInput } from '../types';

export function useFeatures(milestoneId: string | undefined) {
  const api = useApiClient();
  return useQuery({
    queryKey: KEYS.featuresFor(milestoneId),
    queryFn: () => api.listFeatures(milestoneId!),
    enabled: !!milestoneId,
  });
}

export function useCreateFeature(milestoneId: string, projectId: string) {
  const api = useApiClient();
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
  const api = useApiClient();
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
  const api = useApiClient();
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
  const api = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.transitionFeature(id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.featuresFor(milestoneId) });
      qc.invalidateQueries({ queryKey: KEYS.summary(projectId) });
    },
  });
}
