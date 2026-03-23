import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import type { PaginatedResponse } from '@packages/common';
import type { EntityApi } from '../types';

/**
 * Creates a full set of TanStack Query hooks for a single entity.
 *
 * @param entityType — entity type key (used as query key prefix)
 * @param singularName — display name for toast messages
 * @param api — entity API client (from createEntityApi)
 */
export function createEntityHooks(entityType: string, singularName: string, api: EntityApi) {
  const listKey = [entityType];
  const detailKey = [entityType, 'detail'];

  function useList(params: Record<string, unknown>) {
    return useQuery({
      queryKey: [...listKey, params],
      queryFn: () => api.list(params),
    });
  }

  function useDetail(id: string | null | undefined) {
    return useQuery({
      queryKey: [...detailKey, id],
      queryFn: () => api.get(id!),
      enabled: !!id,
    });
  }

  function useCreate(options?: { onSuccess?: (entity: Record<string, unknown>) => void }) {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (data: Record<string, unknown>) => api.create(data),
      onSuccess: (entity) => {
        queryClient.invalidateQueries({ queryKey: listKey });
        toast.success(`${singularName} created`);
        options?.onSuccess?.(entity);
      },
      onError: (error: any) => {
        toast.error(error?.body?.message || `Failed to create ${singularName.toLowerCase()}`);
      },
    });
  }

  function useUpdate(options?: { onSuccess?: () => void }) {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.update(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listKey });
        queryClient.invalidateQueries({ queryKey: detailKey });
        toast.success(`${singularName} updated`);
        options?.onSuccess?.();
      },
      onError: (error: any) => {
        toast.error(error?.body?.message || `Failed to update ${singularName.toLowerCase()}`);
      },
    });
  }

  function useDelete(options?: { onSuccess?: () => void }) {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => api.delete(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listKey });
        toast.success(`${singularName} deleted`);
        options?.onSuccess?.();
      },
      onError: (error: any) => {
        toast.error(error?.body?.message || `Failed to delete ${singularName.toLowerCase()}`);
      },
    });
  }

  function useRestore() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => api.restore(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: listKey });
        toast.success(`${singularName} restored`);
      },
      onError: (error: any) => {
        toast.error(error?.body?.message || `Failed to restore ${singularName.toLowerCase()}`);
      },
    });
  }

  return { useList, useDetail, useCreate, useUpdate, useDelete, useRestore };
}

export type EntityHooks = ReturnType<typeof createEntityHooks>;
