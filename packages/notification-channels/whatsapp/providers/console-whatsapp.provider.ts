import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { WhatsAppProvider, WhatsAppPayload, SendResult } from '../../types';

@Injectable()
export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'console';
  private readonly logger: ContextLogger;

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(ConsoleWhatsAppProvider.name);
  }

  async send(payload: WhatsAppPayload): Promise<SendResult> {
    this.logger.log({
      to: payload.to,
      correlationId: payload.correlationId,
    }, 'WhatsApp sent (console provider — no actual delivery)');

    return { success: true };
  }
}
