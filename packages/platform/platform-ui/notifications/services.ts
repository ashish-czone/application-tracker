import type { PaginatedResponse } from '@packages/common';
import type { ApiFn } from '../PlatformUIProvider';
import type {
  NotificationTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ListTemplatesParams,
} from './types';

export function createNotificationsApi(api: ApiFn) {
  return {
    listTemplates(params: ListTemplatesParams): Promise<PaginatedResponse<NotificationTemplate>> {
      const sp = new URLSearchParams();
      if (params.page && params.page > 1) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      if (params.search) sp.set('search', params.search);
      if (params.channel) sp.set('channel', params.channel);
      if (params.sort) sp.set('sort', params.sort);
      if (params.order) sp.set('order', params.order);
      const qs = sp.toString();
      return api.get<PaginatedResponse<NotificationTemplate>>(`/notification-templates${qs ? `?${qs}` : ''}`);
    },

    getTemplate(id: string): Promise<NotificationTemplate> {
      return api.get<NotificationTemplate>(`/notification-templates/${id}`);
    },

    createTemplate(data: CreateTemplateRequest): Promise<NotificationTemplate> {
      return api.post<NotificationTemplate>('/notification-templates', data);
    },

    updateTemplate(id: string, data: UpdateTemplateRequest): Promise<NotificationTemplate> {
      return api.patch<NotificationTemplate>(`/notification-templates/${id}`, data);
    },

    deleteTemplate(id: string): Promise<void> {
      return api.delete<void>(`/notification-templates/${id}`);
    },
  };
}

export type NotificationsApi = ReturnType<typeof createNotificationsApi>;
