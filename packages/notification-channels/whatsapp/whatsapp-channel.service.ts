import { Injectable, Logger } from '@nestjs/common';
import type { WhatsAppProvider, WhatsAppPayload, SendResult } from '../types';

@Injectable()
export class WhatsAppChannelService {
  private readonly logger = new Logger(WhatsAppChannelService.name);
  private readonly providers = new Map<string, WhatsAppProvider>();
  private activeProviderName: string | null = null;

  registerProvider(provider: WhatsAppProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered WhatsApp provider: ${provider.name}`);
  }

  setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`WhatsApp provider "${name}" is not registered`);
    }
    this.activeProviderName = name;
    this.logger.log(`Active WhatsApp provider set to: ${name}`);
  }

  async send(payload: WhatsAppPayload): Promise<SendResult> {
    const provider = this.getActiveProvider();
    if (!provider) {
      this.logger.warn('No active WhatsApp provider configured — skipping send');
      return { success: false, error: 'No active WhatsApp provider configured' };
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
      }, 'WhatsApp send failed');
      return { success: false, error: message };
    }
  }

  private getActiveProvider(): WhatsAppProvider | undefined {
    if (!this.activeProviderName) return undefined;
    return this.providers.get(this.activeProviderName);
  }
}
