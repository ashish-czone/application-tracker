import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { WhatsAppProvider, WhatsAppPayload, SendResult } from '../../types';

export interface TwilioWhatsAppConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

@Injectable()
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'twilio';
  private readonly logger: ContextLogger;
  private config: TwilioWhatsAppConfig | null = null;

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(TwilioWhatsAppProvider.name);
  }

  configure(config: TwilioWhatsAppConfig): void {
    this.config = config;
  }

  async send(payload: WhatsAppPayload): Promise<SendResult> {
    if (!this.config) {
      return { success: false, error: 'Twilio WhatsApp provider not configured' };
    }

    const { accountSid, authToken, fromNumber } = this.config;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${fromNumber}`,
          To: `whatsapp:${payload.to}`,
          Body: payload.body,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error({
          status: response.status,
          correlationId: payload.correlationId,
          error: errorBody,
        }, 'Twilio WhatsApp API error');
        return { success: false, error: `Twilio API error: ${response.status}` };
      }

      const data = await response.json() as { sid?: string };

      return { success: true, providerMessageId: data.sid };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({
        correlationId: payload.correlationId,
        error: message,
      }, 'Twilio WhatsApp send failed');
      return { success: false, error: message };
    }
  }
}
