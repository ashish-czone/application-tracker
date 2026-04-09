// ---- Channel provider contract (used by all channel implementations) ----

export type NotificationChannel = 'email' | 'in_app' | 'whatsapp';

export interface RenderedNotification {
  title: string;
  body: string;
  subject?: string;
}

export interface ChannelContext {
  eventName: string;
  entityType: string;
  entityId: string;
  correlationId: string;
}

export interface ChannelProvider {
  readonly channel: NotificationChannel;
  send(recipientId: string, content: RenderedNotification, context: ChannelContext): Promise<void>;
}

// ---- Shared types ----

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

// ---- Email ----

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  correlationId: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  readonly name: string;
  send(payload: EmailPayload): Promise<SendResult>;
}

// ---- WhatsApp ----

export interface WhatsAppPayload {
  to: string;
  body: string;
  correlationId: string;
}

export interface WhatsAppProvider {
  readonly name: string;
  send(payload: WhatsAppPayload): Promise<SendResult>;
}
