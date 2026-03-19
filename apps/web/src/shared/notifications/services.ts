import { api } from '../../lib/api';
import type { PaginatedResponse } from '@packages/common';
import type { Notification } from './types';

export function listNotifications(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Notification>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  return api.get<PaginatedResponse<Notification>>(`/notifications${qs ? `?${qs}` : ''}`);
}

export function getUnreadCount(): Promise<{ count: number }> {
  return api.get<{ count: number }>('/notifications/unread-count');
}

export function markAsRead(id: string): Promise<void> {
  return api.patch<void>(`/notifications/${id}/read`);
}

export function markAllAsRead(): Promise<void> {
  return api.patch<void>('/notifications/read-all');
}
