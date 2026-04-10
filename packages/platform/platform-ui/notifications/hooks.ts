import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { usePlatformAPI } from '../PlatformUIProvider';
import { createNotificationsApi } from './services';
import type { ListTemplatesParams, CreateTemplateRequest, UpdateTemplateRequest } from './types';

function useNotificationsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createNotificationsApi(apiFn), [apiFn]);
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
