import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DocumentTemplate, TemplateCategory, RenderResult } from './types';

export type ApiFn = {
  get: <T>(url: string) => Promise<T>;
  post: <T>(url: string, body?: unknown) => Promise<T>;
  patch: <T>(url: string, body?: unknown) => Promise<T>;
  delete: (url: string) => Promise<void>;
};

const QUERY_KEY = 'document-templates';

export function useDocumentTemplates(apiFn: ApiFn, category?: string) {
  return useQuery({
    queryKey: [QUERY_KEY, category],
    queryFn: () => {
      const url = category ? `/document-templates?category=${encodeURIComponent(category)}` : '/document-templates';
      return apiFn.get<DocumentTemplate[]>(url);
    },
  });
}

export function useDocumentTemplate(apiFn: ApiFn, id: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, id],
    queryFn: () => apiFn.get<DocumentTemplate>(`/document-templates/${id}`),
    enabled: !!id,
  });
}

export function useTemplateCategories(apiFn: ApiFn) {
  return useQuery({
    queryKey: [QUERY_KEY, 'categories'],
    queryFn: () => apiFn.get<TemplateCategory[]>('/document-templates/categories'),
  });
}

export function useCreateTemplate(apiFn: ApiFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; category: string; subject?: string; htmlBody: string; isDefault?: boolean }) =>
      apiFn.post<DocumentTemplate>('/document-templates', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useUpdateTemplate(apiFn: ApiFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; subject?: string; htmlBody?: string; isDefault?: boolean }) =>
      apiFn.patch<DocumentTemplate>(`/document-templates/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useDeleteTemplate(apiFn: ApiFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFn.delete(`/document-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useTemplatePreview(apiFn: ApiFn, templateId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, templateId, 'preview'],
    queryFn: () => apiFn.post<RenderResult>(`/document-templates/${templateId}/preview`),
    enabled: !!templateId,
  });
}

export function useRenderTemplate(apiFn: ApiFn) {
  return useMutation({
    mutationFn: ({ templateId, contextId }: { templateId: string; contextId: string }) =>
      apiFn.post<RenderResult>(`/document-templates/${templateId}/render`, { contextId }),
  });
}
