import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, EmailPayload, SendResult } from '../../types';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(payload: EmailPayload): Promise<SendResult> {
    this.logger.log({
      recipientId: payload.recipientId,
      subject: payload.subject,
      correlationId: payload.correlationId,
    }, 'Email sent (console provider — no actual delivery)');

    return { success: true };
  }
}
