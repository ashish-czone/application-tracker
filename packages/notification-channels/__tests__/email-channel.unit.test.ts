import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailChannelService } from '../email/email-channel.service';
import { ConsoleEmailProvider } from '../email/providers/console-email.provider';
import { SmtpEmailProvider } from '../email/providers/smtp-email.provider';
import type { EmailProvider, EmailPayload } from '../types';

function buildPayload(overrides: Partial<EmailPayload> = {}): EmailPayload {
  return {
    to: 'user@example.com',
    subject: 'Test Subject',
    body: '<p>Hello</p>',
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('EmailChannelService', () => {
  let service: EmailChannelService;

  beforeEach(() => {
    service = new EmailChannelService();
  });

  it('should register and use a provider', async () => {
    const mockProvider: EmailProvider = {
      name: 'mock',
      send: vi.fn().mockResolvedValue({ success: true, providerMessageId: 'msg-1' }),
    };

    service.registerProvider(mockProvider);
    service.setActiveProvider('mock');

    const result = await service.send(buildPayload());

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('msg-1');
    expect(mockProvider.send).toHaveBeenCalledWith(buildPayload());
  });

  it('should return error when no active provider configured', async () => {
    const result = await service.send(buildPayload());

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active email provider');
  });

  it('should throw when setting non-existent provider', () => {
    expect(() => service.setActiveProvider('nonexistent')).toThrow(
      'Email provider "nonexistent" is not registered',
    );
  });

  it('should catch provider errors and return failure', async () => {
    const failProvider: EmailProvider = {
      name: 'fail',
      send: vi.fn().mockRejectedValue(new Error('SMTP connection refused')),
    };

    service.registerProvider(failProvider);
    service.setActiveProvider('fail');

    const result = await service.send(buildPayload());

    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP connection refused');
  });

  it('should allow switching active provider', async () => {
    const providerA: EmailProvider = {
      name: 'a',
      send: vi.fn().mockResolvedValue({ success: true }),
    };
    const providerB: EmailProvider = {
      name: 'b',
      send: vi.fn().mockResolvedValue({ success: true }),
    };

    service.registerProvider(providerA);
    service.registerProvider(providerB);

    service.setActiveProvider('a');
    await service.send(buildPayload());
    expect(providerA.send).toHaveBeenCalledTimes(1);
    expect(providerB.send).not.toHaveBeenCalled();

    service.setActiveProvider('b');
    await service.send(buildPayload());
    expect(providerB.send).toHaveBeenCalledTimes(1);
  });
});

describe('ConsoleEmailProvider', () => {
  it('should return success without actually sending', async () => {
    const provider = new ConsoleEmailProvider();

    const result = await provider.send(buildPayload());

    expect(result.success).toBe(true);
    expect(provider.name).toBe('console');
  });
});

describe('SmtpEmailProvider', () => {
  it('should fail when not configured', async () => {
    const provider = new SmtpEmailProvider();

    const result = await provider.send(buildPayload());

    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('should send via nodemailer transporter when configured', async () => {
    const provider = new SmtpEmailProvider();
    const mockSendMail = vi.fn().mockResolvedValue({ messageId: '<msg-123@smtp>' });
    const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail });

    vi.doMock('nodemailer', () => ({ createTransport: mockCreateTransport }));

    provider.configure({
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      auth: { user: 'test', pass: 'pass' },
      from: 'noreply@test.com',
    });

    // Manually set transporter since doMock doesn't affect require in configure()
    (provider as any).transporter = { sendMail: mockSendMail };

    const result = await provider.send(buildPayload());

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe('<msg-123@smtp>');
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'noreply@test.com',
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });
  });

  it('should handle transporter errors', async () => {
    const provider = new SmtpEmailProvider();
    const mockSendMail = vi.fn().mockRejectedValue(new Error('Connection refused'));

    (provider as any).config = { from: 'noreply@test.com' };
    (provider as any).transporter = { sendMail: mockSendMail };

    const result = await provider.send(buildPayload());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });
});
