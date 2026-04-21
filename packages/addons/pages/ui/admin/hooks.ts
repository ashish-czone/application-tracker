import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlatformAPI } from '@packages/platform-ui';
import type { DataSource } from '@packages/blocks-contract';
import { createPagesApi } from './services';
import type { CreatePageInput, UpdatePageInput } from './types';

function usePagesApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createPagesApi(apiFn), [apiFn]);
}

export function usePagesList(params: { page?: number; limit?: number; search?: string } = {}) {
  const api = usePagesApi();
  return useQuery({
    queryKey: ['pages', 'list', params],
    queryFn: () => api.listPages(params),
  });
}

export function usePage(id: string | undefined) {
  const api = usePagesApi();
  return useQuery({
    queryKey: ['pages', 'detail', id],
    queryFn: () => api.getPage(id!),
    enabled: !!id,
  });
}

export function useCreatePage() {
  const api = usePagesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePageInput) => api.createPage(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', 'list'] }),
  });
}

export function useUpdatePage() {
  const api = usePagesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePageInput }) => api.updatePage(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['pages', 'list'] });
      qc.invalidateQueries({ queryKey: ['pages', 'detail', vars.id] });
    },
  });
}

export function useDeletePage() {
  const api = usePagesApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pages', 'list'] }),
  });
}

export function useSectionsForPage(pageId: string | undefined) {
  const api = usePagesApi();
  return useQuery({
    queryKey: ['sections', 'for-page', pageId],
    queryFn: () => api.listSections(pageId!),
    enabled: !!pageId,
  });
}

/**
 * Replace-all save strategy: DELETE every existing section for the page,
 * then POST the provided drafts in their current order. Simple and
 * idempotent for v1 (landing pages hold a few dozen sections at most);
 * a future diff-based save is a follow-up when payloads grow.
 */
export function useSavePageSections() {
  const api = usePagesApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pageId,
      existingIds,
      drafts,
    }: {
      pageId: string;
      existingIds: string[];
      drafts: {
        order: number;
        blockKind: string;
        variant: string | null;
        customFields: Record<string, unknown>;
        dataSource: DataSource | null;
      }[];
    }) => {
      await Promise.all(existingIds.map((id) => api.deleteSection(id)));
      for (const d of drafts) {
        await api.createSection({
          pageId,
          order: d.order,
          blockKind: d.blockKind,
          variant: d.variant ?? undefined,
          customFields: d.customFields,
          dataSource: d.dataSource,
        });
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['sections', 'for-page', vars.pageId] });
    },
  });
}
