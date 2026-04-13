import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { createAutomationsApi } from './services';
import type {
  ListAutomationRulesParams, ListExecutionsParams,
  CreateAutomationRuleRequest, UpdateAutomationRuleRequest,
} from './types';

function useAutomationsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createAutomationsApi(apiFn), [apiFn]);
}

// --- Automation Rules ---

export function useAutomationRules(params: ListAutomationRulesParams) {
  const api = useAutomationsApi();
  return useQuery({
    queryKey: ['automation-rules', params],
    queryFn: () => api.listAutomationRules(params),
  });
}

export function useAutomationRule(id: string) {
  const api = useAutomationsApi();
  return useQuery({
    queryKey: ['automation-rules', id],
    queryFn: () => api.getAutomationRule(id),
    enabled: !!id,
  });
}

export function useCreateAutomationRule(options?: { onSuccess?: () => void }) {
  const api = useAutomationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAutomationRuleRequest) => api.createAutomationRule(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Automation rule created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create automation rule');
    },
  });
}

export function useUpdateAutomationRule(options?: { onSuccess?: () => void }) {
  const api = useAutomationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAutomationRuleRequest }) => api.updateAutomationRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Automation rule updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update automation rule');
    },
  });
}

export function useDeleteAutomationRule(options?: { onSuccess?: () => void }) {
  const api = useAutomationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAutomationRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success('Automation rule deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete automation rule');
    },
  });
}

export function useToggleAutomationRule() {
  const api = useAutomationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateAutomationRule(id, { isActive }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success(variables.isActive ? 'Rule activated' : 'Rule deactivated');
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update rule');
    },
  });
}

// --- Metadata ---

export function useEvents() {
  const api = useAutomationsApi();
  return useQuery({
    queryKey: ['automations-events'],
    queryFn: () => api.listEvents(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEntities() {
  const api = useAutomationsApi();
  return useQuery({
    queryKey: ['automations-entities'],
    queryFn: () => api.listEntities(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActionTypes() {
  const api = useAutomationsApi();
  return useQuery({
    queryKey: ['automations-action-types'],
    queryFn: () => api.listActionTypes(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserStrategies() {
  const api = useAutomationsApi();
  return useQuery({
    queryKey: ['automations-user-strategies'],
    queryFn: () => api.listUserStrategies(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEntityFields(entityType: string | undefined) {
  const api = useAutomationsApi();
  return useQuery({
    queryKey: ['entity-fields', entityType],
    queryFn: () => api.getEntityFields(entityType!),
    enabled: !!entityType,
  });
}

// --- Execution Log ---

export function useAutomationExecutions(params: ListExecutionsParams) {
  const api = useAutomationsApi();
  return useQuery({
    queryKey: ['automation-executions', params],
    queryFn: () => api.listExecutions(params),
  });
}
