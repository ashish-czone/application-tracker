import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '../PlatformUIProvider';
import { createNotificationsApi } from './services';
import type {
  ListAutomationRulesParams, CreateAutomationRuleRequest, UpdateAutomationRuleRequest,
  ListTemplatesParams, CreateTemplateRequest, UpdateTemplateRequest,
} from './types';

function useNotificationsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createNotificationsApi(apiFn), [apiFn]);
}

// --- Automation Rules ---

export function useAutomationRules(params: ListAutomationRulesParams) {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['automation-rules', params],
    queryFn: () => api.listAutomationRules(params),
  });
}

export function useAutomationRule(id: string) {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['automation-rules', id],
    queryFn: () => api.getAutomationRule(id),
    enabled: !!id,
  });
}

export function useCreateAutomationRule(options?: { onSuccess?: () => void }) {
  const api = useNotificationsApi();
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
  const api = useNotificationsApi();
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
  const api = useNotificationsApi();
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
  const api = useNotificationsApi();
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

// --- Templates ---

export function useTemplates(params: ListTemplatesParams) {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['notification-templates', params],
    queryFn: () => api.listTemplates(params),
  });
}

export function useTemplate(id: string) {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['notification-templates', id],
    queryFn: () => api.getTemplate(id),
    enabled: !!id,
  });
}

export function useCreateTemplate(options?: { onSuccess?: () => void }) {
  const api = useNotificationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplateRequest) => api.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success('Template created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create template');
    },
  });
}

export function useUpdateTemplate(options?: { onSuccess?: () => void }) {
  const api = useNotificationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTemplateRequest }) => api.updateTemplate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success('Template updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update template');
    },
  });
}

export function useDeleteTemplate(options?: { onSuccess?: () => void }) {
  const api = useNotificationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success('Template deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete template');
    },
  });
}

// --- Metadata ---

export function useEvents() {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['automations-events'],
    queryFn: () => api.listEvents(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEntities() {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['automations-entities'],
    queryFn: () => api.listEntities(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActionTypes() {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['automations-action-types'],
    queryFn: () => api.listActionTypes(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserStrategies() {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['automations-user-strategies'],
    queryFn: () => api.listUserStrategies(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEntityFields(entityType: string | undefined) {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['entity-fields', entityType],
    queryFn: () => api.getEntityFields(entityType!),
    enabled: !!entityType,
  });
}
