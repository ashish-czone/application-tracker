import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { EmailProvider, EmailPayload, SendResult } from '../types';

@Injectable()
export class EmailChannelService {
  private readonly logger: ContextLogger;
  private readonly providers = new Map<string, EmailProvider>();

  constructor(appLogger: AppLoggerService) {
    this.logger = appLogger.forContext(EmailChannelService.name);
  }
  private activeProviderName: string | null = null;

  registerProvider(provider: EmailProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered email provider: ${provider.name}`);
  }

  setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Email provider "${name}" is not registered`);
    }
    this.activeProviderName = name;
    this.logger.log(`Active email provider set to: ${name}`);
  }

  async send(payload: EmailPayload): Promise<SendResult> {
    const provider = this.getActiveProvider();
    if (!provider) {
      this.logger.warn('No active email provider configured — skipping send');
      return { success: false, error: 'No active email provider configured' };
    }

    try {
      return await provider.send(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Email send failed', {
        provider: provider.name,
        to: payload.to,
        correlationId: payload.correlationId,
        error: message,
      });
      return { success: false, error: message };
    }
  }

  private getActiveProvider(): EmailProvider | undefined {
    if (!this.activeProviderName) return undefined;
    return this.providers.get(this.activeProviderName);
  }
}
