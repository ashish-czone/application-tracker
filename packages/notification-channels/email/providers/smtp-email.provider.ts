import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { EmailProvider, EmailPayload, SendResult } from '../../types';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  from: string;
}

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger: ContextLogger;
  private config: SmtpConfig | null = null;

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(SmtpEmailProvider.name);
  }
  private transporter: any = null;

  configure(config: SmtpConfig): void {
    this.config = config;
    try {
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      });
    } catch {
      this.logger.error('nodemailer is not installed — run: pnpm add nodemailer');
    }
  }

  async send(payload: EmailPayload): Promise<SendResult> {
    if (!this.config || !this.transporter) {
      return { success: false, error: 'SMTP provider not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.body,
      });

      return { success: true, providerMessageId: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('SMTP email send failed', {
        to: payload.to,
        correlationId: payload.correlationId,
        error: message,
      });
      return { success: false, error: message };
    }
  }
}
