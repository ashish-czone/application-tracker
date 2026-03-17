import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppChannelService } from '../whatsapp/whatsapp-channel.service';
import { ConsoleWhatsAppProvider } from '../whatsapp/providers/console-whatsapp.provider';
import { TwilioWhatsAppProvider } from '../whatsapp/providers/twilio-whatsapp.provider';
import type { WhatsAppProvider, WhatsAppPayload } from '../types';

function buildPayload(overrides: Partial<WhatsAppPayload> = {}): WhatsAppPayload {
  return {
    to: '+15551234567',
    body: 'Hello from WhatsApp',
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('WhatsAppChannelService', () => {
  let service: WhatsAppChannelService;

  beforeEach(() => {
    service = new WhatsAppChannelService();
  });

  it('should register and use a provider', async () => {
    const mockProvider: WhatsAppProvider = {
      name: 'mock',
      send: vi.fn().mockResolvedValue({ success: true, providerMessageId: 'wa-1' }),
    };

    service.registerProvider(mockProvider);
    service.setActiveProvider('mock');

    const result = await service.send(buildPayload());

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('wa-1');
    expect(mockProvider.send).toHaveBeenCalledWith(buildPayload());
  });

  it('should return error when no active provider configured', async () => {
    const result = await service.send(buildPayload());

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active WhatsApp provider');
  });

  it('should throw when setting non-existent provider', () => {
    expect(() => service.setActiveProvider('nonexistent')).toThrow(
      'WhatsApp provider "nonexistent" is not registered',
    );
  });

  it('should catch provider errors and return failure', async () => {
    const failProvider: WhatsAppProvider = {
      name: 'fail',
      send: vi.fn().mockRejectedValue(new Error('Twilio API timeout')),
    };

    service.registerProvider(failProvider);
    service.setActiveProvider('fail');

    const result = await service.send(buildPayload());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Twilio API timeout');
  });
});

describe('ConsoleWhatsAppProvider', () => {
  it('should return success without actually sending', async () => {
    const provider = new ConsoleWhatsAppProvider();

    const result = await provider.send(buildPayload());

    expect(result.success).toBe(true);
    expect(provider.name).toBe('console');
  });
});

describe('TwilioWhatsAppProvider', () => {
  it('should fail when not configured', async () => {
    const provider = new TwilioWhatsAppProvider();

    const result = await provider.send(buildPayload());

    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('should call Twilio API when configured', async () => {
    const provider = new TwilioWhatsAppProvider();
    provider.configure({
      accountSid: 'AC_TEST',
      authToken: 'test_token',
      fromNumber: '+14155238886',
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sid: 'SM_TEST_123' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await provider.send(buildPayload());

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('SM_TEST_123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.twilio.com/2010-04-01/Accounts/AC_TEST/Messages.json',
      expect.objectContaining({ method: 'POST' }),
    );

    vi.unstubAllGlobals();
  });

  it('should handle Twilio API errors', async () => {
    const provider = new TwilioWhatsAppProvider();
    provider.configure({
      accountSid: 'AC_TEST',
      authToken: 'test_token',
      fromNumber: '+14155238886',
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }));

    const result = await provider.send(buildPayload());

    expect(result.success).toBe(false);
    expect(result.error).toContain('401');

    vi.unstubAllGlobals();
  });

  it('should handle network errors', async () => {
    const provider = new TwilioWhatsAppProvider();
    provider.configure({
      accountSid: 'AC_TEST',
      authToken: 'test_token',
      fromNumber: '+14155238886',
    });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unreachable')));

    const result = await provider.send(buildPayload());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network unreachable');

    vi.unstubAllGlobals();
  });
});
