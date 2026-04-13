import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '@packages/platform-ui';
import type { Notification } from './types';

export function createNotificationChannelsApi(api: ApiFn) {
  return {
    listNotifications(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Notification>> {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      const qs = searchParams.toString();
      return api.get<PaginatedResponse<Notification>>(`/notifications${qs ? `?${qs}` : ''}`);
    },
    getUnreadCount(): Promise<{ count: number }> {
      return api.get<{ count: number }>('/notifications/unread-count');
    },
    markAsRead(id: string): Promise<void> {
      return api.patch<void>(`/notifications/${id}/read`);
    },
    markAllAsRead(): Promise<void> {
      return api.patch<void>('/notifications/read-all');
    },
  };
}

export type NotificationChannelsUiApi = ReturnType<typeof createNotificationChannelsApi>;
