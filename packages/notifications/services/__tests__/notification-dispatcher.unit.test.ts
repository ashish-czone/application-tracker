import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationDispatcher } from '../notification-dispatcher';
import { ContactResolverRegistry } from '../contact-resolver-registry';
import type { ChannelProvider, ChannelContext, RenderedNotification } from '../../types';
import type { AppLoggerService } from '@packages/logger';

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

function buildContext(): ChannelContext {
  return {
    eventName: 'users.UserCreated',
    entityType: 'users',
    entityId: 'user-1',
    correlationId: 'corr-1',
  };
}

function buildContent(): RenderedNotification {
  return { title: 'Welcome', body: 'Hello John', subject: 'Welcome!' };
}

function createMockQueueService() {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
  };
}

describe('NotificationDispatcher', () => {
  let dispatcher: NotificationDispatcher;
  let contactRegistry: ContactResolverRegistry;
  let queueService: ReturnType<typeof createMockQueueService>;

  beforeEach(() => {
    const mockLogger = createMockAppLogger();
    contactRegistry = new ContactResolverRegistry(mockLogger);
    queueService = createMockQueueService();
    dispatcher = new NotificationDispatcher(queueService as any, contactRegistry, mockLogger);
  });

  it('should dispatch in_app to inline channel provider', async () => {
    const inAppProvider: ChannelProvider = {
      channel: 'in_app',
      send: vi.fn().mockResolvedValue(undefined),
    };
    dispatcher.registerInlineChannel(inAppProvider);

    await dispatcher.dispatch('in_app', 'user-1', buildContent(), buildContext());

    expect(inAppProvider.send).toHaveBeenCalledWith('user-1', buildContent(), buildContext());
    expect(queueService.enqueue).not.toHaveBeenCalled();
  });

  it('should resolve email and enqueue for email channel', async () => {
    contactRegistry.register('email', async () => 'john@example.com');

    await dispatcher.dispatch('email', 'user-1', buildContent(), buildContext());

    expect(queueService.enqueue).toHaveBeenCalledWith('notification.email', {
      to: 'john@example.com',
      subject: 'Welcome!',
      body: 'Hello John',
      correlationId: 'corr-1',
    });
  });

  it('should resolve phone and enqueue for whatsapp channel', async () => {
    contactRegistry.register('whatsapp', async () => '+15551234567');

    await dispatcher.dispatch('whatsapp', 'user-1', buildContent(), buildContext());

    expect(queueService.enqueue).toHaveBeenCalledWith('notification.whatsapp', {
      to: '+15551234567',
      body: 'Hello John',
      correlationId: 'corr-1',
    });
  });

  it('should skip email when contact resolver returns null', async () => {
    contactRegistry.register('email', async () => null);

    await dispatcher.dispatch('email', 'user-1', buildContent(), buildContext());

    expect(queueService.enqueue).not.toHaveBeenCalled();
  });

  it('should skip email when no contact resolver registered', async () => {
    // No resolver registered for 'email'
    await dispatcher.dispatch('email', 'user-1', buildContent(), buildContext());

    expect(queueService.enqueue).not.toHaveBeenCalled();
  });

  it('should skip silently for unknown channel', async () => {
    await expect(
      dispatcher.dispatch('sms' as any, 'user-1', buildContent(), buildContext()),
    ).resolves.toBeUndefined();

    expect(queueService.enqueue).not.toHaveBeenCalled();
  });

  it('should catch and log errors without throwing', async () => {
    contactRegistry.register('email', async () => 'john@example.com');
    queueService.enqueue.mockRejectedValue(new Error('Redis down'));

    await expect(
      dispatcher.dispatch('email', 'user-1', buildContent(), buildContext()),
    ).resolves.toBeUndefined();
  });

  it('should use content.title as subject fallback when subject is undefined', async () => {
    contactRegistry.register('email', async () => 'john@example.com');
    const content: RenderedNotification = { title: 'Fallback Title', body: 'Body' };

    await dispatcher.dispatch('email', 'user-1', content, buildContext());

    expect(queueService.enqueue).toHaveBeenCalledWith('notification.email', expect.objectContaining({
      subject: 'Fallback Title',
    }));
  });
});
