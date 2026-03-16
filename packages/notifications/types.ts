export type NotificationChannel = 'email' | 'in_app' | 'whatsapp';

export type RecipientStrategy = 'actor' | 'entity_owner' | 'role';

export interface NotificationRule {
  id: string;
  name: string;
  eventName: string;
  recipientStrategy: RecipientStrategy;
  recipientConfig: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
}

export interface NotificationRuleChannel {
  ruleId: string;
  channel: NotificationChannel;
  templateId: string;
}

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
