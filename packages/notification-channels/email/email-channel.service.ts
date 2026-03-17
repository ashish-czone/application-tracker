import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, EmailPayload, SendResult } from '../types';

@Injectable()
export class EmailChannelService {
  private readonly logger = new Logger(EmailChannelService.name);
  private readonly providers = new Map<string, EmailProvider>();
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
      this.logger.error({
        provider: provider.name,
        to: payload.to,
        correlationId: payload.correlationId,
        error: message,
      }, 'Email send failed');
      return { success: false, error: message };
    }
  }

  private getActiveProvider(): EmailProvider | undefined {
    if (!this.activeProviderName) return undefined;
    return this.providers.get(this.activeProviderName);
  }
}
