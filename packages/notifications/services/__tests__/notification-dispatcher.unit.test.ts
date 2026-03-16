import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationDispatcher } from '../notification-dispatcher';
import type { ChannelProvider, ChannelContext, RenderedNotification } from '../../types';

function buildContext(): ChannelContext {
  return {
    eventName: 'users.UserCreated',
    entityType: 'users',
    entityId: 'user-1',
    correlationId: 'corr-1',
  };
}

function buildContent(): RenderedNotification {
  return { title: 'Welcome', body: 'Hello John' };
}

describe('NotificationDispatcher', () => {
  let dispatcher: NotificationDispatcher;

  beforeEach(() => {
    dispatcher = new NotificationDispatcher();
  });

  it('should dispatch to the correct channel provider', async () => {
    const mockProvider: ChannelProvider = {
      channel: 'email',
      send: vi.fn().mockResolvedValue(undefined),
    };
    dispatcher.registerChannel(mockProvider);

    await dispatcher.dispatch('email', 'user-1', buildContent(), buildContext());

    expect(mockProvider.send).toHaveBeenCalledWith('user-1', buildContent(), buildContext());
  });

  it('should skip silently when no provider registered for channel', async () => {
    // No error thrown
    await expect(
      dispatcher.dispatch('whatsapp', 'user-1', buildContent(), buildContext()),
    ).resolves.toBeUndefined();
  });

  it('should catch and log errors from channel providers', async () => {
    const mockProvider: ChannelProvider = {
      channel: 'email',
      send: vi.fn().mockRejectedValue(new Error('SMTP down')),
    };
    dispatcher.registerChannel(mockProvider);

    // Should not throw
    await expect(
      dispatcher.dispatch('email', 'user-1', buildContent(), buildContext()),
    ).resolves.toBeUndefined();
  });

  it('should support multiple channels', async () => {
    const emailProvider: ChannelProvider = {
      channel: 'email',
      send: vi.fn().mockResolvedValue(undefined),
    };
    const inAppProvider: ChannelProvider = {
      channel: 'in_app',
      send: vi.fn().mockResolvedValue(undefined),
    };
    dispatcher.registerChannel(emailProvider);
    dispatcher.registerChannel(inAppProvider);

    await dispatcher.dispatch('email', 'user-1', buildContent(), buildContext());
    await dispatcher.dispatch('in_app', 'user-1', buildContent(), buildContext());

    expect(emailProvider.send).toHaveBeenCalledTimes(1);
    expect(inAppProvider.send).toHaveBeenCalledTimes(1);
  });
});
