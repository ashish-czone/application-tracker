import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import {
  listRules, getRule, createRule, updateRule, deleteRule,
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  listEvents, listEntities,
} from './services';
import type {
  ListRulesParams, CreateRuleRequest, UpdateRuleRequest,
  ListTemplatesParams, CreateTemplateRequest, UpdateTemplateRequest,
} from './types';

// --- Rules ---

export function useRules(params: ListRulesParams) {
  return useQuery({
    queryKey: ['notification-rules', params],
    queryFn: () => listRules(params),
  });
}

export function useRule(id: string) {
  return useQuery({
    queryKey: ['notification-rules', id],
    queryFn: () => getRule(id),
    enabled: !!id,
  });
}

export function useCreateRule(options?: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRuleRequest) => createRule(data),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRuleRequest }) => updateRule(id, data),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRule(id),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateRule(id, { isActive }),
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
  return useQuery({
    queryKey: ['notification-templates', params],
    queryFn: () => listTemplates(params),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['notification-templates', id],
    queryFn: () => getTemplate(id),
    enabled: !!id,
  });
}

export function useCreateTemplate(options?: { onSuccess?: () => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTemplateRequest) => createTemplate(data),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTemplateRequest }) => updateTemplate(id, data),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
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

// --- Metadata registries ---

export function useEvents() {
  return useQuery({
    queryKey: ['automations-events'],
    queryFn: listEvents,
    staleTime: 5 * 60 * 1000, // events rarely change — cache 5 min
  });
}

export function useEntities() {
  return useQuery({
    queryKey: ['automations-entities'],
    queryFn: listEntities,
    staleTime: 5 * 60 * 1000,
  });
}
