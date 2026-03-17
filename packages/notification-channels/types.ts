// ---- Shared types ----

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

// ---- Email ----

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  correlationId: string;
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
