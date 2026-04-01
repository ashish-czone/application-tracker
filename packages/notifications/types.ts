export type NotificationChannel = 'email' | 'in_app' | 'whatsapp';

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RenderedNotification {
  title: string;
  body: string;
  subject?: string;
}

export interface ChannelProvider {
  readonly channel: NotificationChannel;
  send(recipientId: string, content: RenderedNotification, context: ChannelContext): Promise<void>;
}

export interface ChannelContext {
  eventName: string;
  entityType: string;
  entityId: string;
  correlationId: string;
}
