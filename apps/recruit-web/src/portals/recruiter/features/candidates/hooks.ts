import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { listCandidates, getCandidate, createCandidate, updateCandidate, deleteCandidate, restoreCandidate } from './services';
import type { Candidate, ListCandidatesParams, CreateCandidateRequest, UpdateCandidateRequest } from './types';

export function useCandidates(params: ListCandidatesParams) {
  return useQuery({
    queryKey: ['candidates', params],
    queryFn: () => listCandidates(params),
  });
}

export function useCandidate(id: string | null) {
  return useQuery({
    queryKey: ['candidate', id],
    queryFn: () => getCandidate(id!),
    enabled: !!id,
  });
}

export function useCreateCandidate(options?: { onSuccess?: (candidate: Candidate) => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCandidateRequest) => createCandidate(data),
    onSuccess: (candidate) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate created');
      options?.onSuccess?.(candidate);
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create candidate');
    },
  });
}

export function useUpdateCandidate(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCandidateRequest }) => updateCandidate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidate'] });
      toast.success('Candidate updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update candidate');
    },
  });
}

export function useDeleteCandidate(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCandidate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete candidate');
    },
  });
}

export function useRestoreCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => restoreCandidate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success('Candidate restored');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to restore candidate');
    },
  });
}
