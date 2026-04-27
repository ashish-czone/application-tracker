import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { attachSkill, detachSkill, uploadResume } from '../portals/recruiter/features/candidates/services';
import type { Candidate } from '../portals/recruiter/features/candidates/types';

interface CountResponse {
  meta: { total: number };
}

export function useCandidatesCount() {
  const apiFn = usePlatformAPI();
  return useQuery({
    queryKey: ['dashboard', 'candidates'],
    queryFn: () => apiFn.get<CountResponse>('/candidates?limit=1'),
  });
}

export function useAttachSkill(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => attachSkill(candidateId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', 'detail', candidateId] });
      toast.success('Skill added');
    },
    onError: () => toast.error('Failed to add skill'),
  });
}

export function useDetachSkill(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => detachSkill(candidateId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', 'detail', candidateId] });
      toast.success('Skill removed');
    },
    onError: () => toast.error('Failed to remove skill'),
  });
}

export function useUploadResume(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<Candidate, Error, File>({
    mutationFn: (file: File) => uploadResume(candidateId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates', 'detail', candidateId] });
      toast.success('Resume uploaded');
    },
    onError: () => toast.error('Failed to upload resume'),
  });
}
