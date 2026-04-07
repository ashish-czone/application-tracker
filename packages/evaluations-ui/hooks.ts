import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui/PlatformUIProvider';
import { createEvaluationsApi } from './services';
import type { CreateEvaluationRequest, UpdateEvaluationRequest } from './types';

function useEvaluationsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createEvaluationsApi(apiFn), [apiFn]);
}

export function useEvaluations(entityType: string, entityId: string, page = 1) {
  const api = useEvaluationsApi();
  return useQuery({
    queryKey: ['evaluations', entityType, entityId, page],
    queryFn: () => api.listEvaluations({ entityType, entityId, page }),
    enabled: !!entityType && !!entityId,
  });
}

export function useEvaluationTemplates(entityType: string) {
  const api = useEvaluationsApi();
  return useQuery({
    queryKey: ['evaluation-templates', entityType],
    queryFn: () => api.listTemplates({ entityType, isActive: true }),
    enabled: !!entityType,
  });
}

export function useCreateEvaluation() {
  const api = useEvaluationsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEvaluationRequest) => api.createEvaluation(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evaluations', variables.entityType, variables.entityId] });
      toast.success('Evaluation submitted');
    },
  });
}

export function useUpdateEvaluation() {
  const api = useEvaluationsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEvaluationRequest }) => api.updateEvaluation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast.success('Evaluation updated');
    },
  });
}

export function useDeleteEvaluation() {
  const api = useEvaluationsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteEvaluation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      toast.success('Evaluation deleted');
    },
  });
}
