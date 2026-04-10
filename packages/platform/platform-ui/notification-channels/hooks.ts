import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePlatformAPI } from '../PlatformUIProvider';
import { createNotificationChannelsApi } from './services';

function useNotificationChannelsApi() {
  const apiFn = usePlatformAPI();
  return useMemo(() => createNotificationChannelsApi(apiFn), [apiFn]);
}

export function useNotifications(params?: { page?: number; limit?: number }) {
  const api = useNotificationChannelsApi();
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => api.listNotifications(params),
  });
}

export function useUnreadCount() {
  const api = useNotificationChannelsApi();
  return useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => api.getUnreadCount(),
    refetchInterval: 30_000,
  });
}

export function useMarkAsRead() {
  const api = useNotificationChannelsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useMarkAllAsRead() {
  const api = useNotificationChannelsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}
