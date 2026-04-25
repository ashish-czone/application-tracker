import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlatformAPI } from '@packages/platform-ui';
import { createMenusApi } from './services';
import type {
  CreateMenuItemInput,
  MoveMenuItemInput,
  UpdateMenuItemInput,
} from './types';

function useMenusApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createMenusApi(apiFn), [apiFn]);
}

export function useMenu(id: string | undefined) {
  const api = useMenusApi();
  return useQuery({
    queryKey: ['menus', 'detail', id],
    queryFn: () => api.getMenu(id!),
    enabled: !!id,
  });
}

export function useMenuItems(menuId: string | undefined) {
  const api = useMenusApi();
  return useQuery({
    queryKey: ['menu-items', 'for-menu', menuId],
    queryFn: () => api.listMenuItems(menuId!),
    enabled: !!menuId,
  });
}

export function useCreateMenuItem(menuId: string) {
  const api = useMenusApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMenuItemInput) => api.createMenuItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items', 'for-menu', menuId] }),
  });
}

export function useUpdateMenuItem(menuId: string) {
  const api = useMenusApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateMenuItemInput }) =>
      api.updateMenuItem(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items', 'for-menu', menuId] }),
  });
}

export function useDeleteMenuItem(menuId: string) {
  const api = useMenusApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMenuItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items', 'for-menu', menuId] }),
  });
}

export function useMoveMenuItem(menuId: string) {
  const api = useMenusApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MoveMenuItemInput }) =>
      api.moveMenuItem(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items', 'for-menu', menuId] }),
  });
}

export function usePagesForPicker(search?: string) {
  const api = useMenusApi();
  return useQuery({
    queryKey: ['menus', 'pages-picker', search ?? ''],
    queryFn: () => api.listPagesForPicker(search),
  });
}
