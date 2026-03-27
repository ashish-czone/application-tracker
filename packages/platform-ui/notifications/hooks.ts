import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '../PlatformUIProvider';
import { createNotificationsApi } from './services';
import type {
  ListRulesParams, CreateRuleRequest, UpdateRuleRequest,
  ListTemplatesParams, CreateTemplateRequest, UpdateTemplateRequest,
} from './types';

function useNotificationsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createNotificationsApi(apiFn), [apiFn]);
}

// --- Rules ---

export function useRules(params: ListRulesParams) {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['notification-rules', params],
    queryFn: () => api.listRules(params),
  });
}

export function useRule(id: string) {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['notification-rules', id],
    queryFn: () => api.getRule(id),
    enabled: !!id,
  });
}

export function useCreateRule(options?: { onSuccess?: () => void }) {
  const api = useNotificationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRuleRequest) => api.createRule(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
      toast.success('Automation rule created');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to create rule');
    },
  });
}

export function useUpdateRule(options?: { onSuccess?: () => void }) {
  const api = useNotificationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRuleRequest }) => api.updateRule(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
      toast.success('Rule updated');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to update rule');
    },
  });
}

export function useDeleteRule(options?: { onSuccess?: () => void }) {
  const api = useNotificationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
      toast.success('Rule deleted');
      options?.onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || 'Failed to delete rule');
    },
  });
}

export function useToggleRule() {
  const api = useNotificationsApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateRule(id, { isActive }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['notification-rules'] });
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

export function useEntityFields(entityType: string | undefined) {
  const api = useNotificationsApi();
  return useQuery({
    queryKey: ['entity-fields', entityType],
    queryFn: () => api.getEntityFields(entityType!),
    enabled: !!entityType,
  });
}
