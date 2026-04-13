import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { EmailProvider, EmailPayload, SendResult } from '../../types';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  private readonly logger: ContextLogger;

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(ConsoleEmailProvider.name);
  }

  async send(payload: EmailPayload): Promise<SendResult> {
    this.logger.log('Email sent (console provider — no actual delivery)', {
      to: payload.to,
      subject: payload.subject,
      correlationId: payload.correlationId,
      attachments: payload.attachments?.map((a) => a.filename) ?? [],
    });

    return { success: true };
  }
}
