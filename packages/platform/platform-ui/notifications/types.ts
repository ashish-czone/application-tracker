// --- Notification-specific types ---

export type NotificationChannel = 'email' | 'in_app' | 'whatsapp';

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  subject?: string;
  body?: string;
}

export interface ListTemplatesParams {
  page?: number;
  limit?: number;
  search?: string;
  channel?: NotificationChannel;
  sort?: 'name' | 'createdAt';
  order?: 'asc' | 'desc';
}
