import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InAppChannel } from '../in-app.channel';
import type { RenderedNotification, ChannelContext } from '../../types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenantInsert: vi.fn((_table, data) => data),
}));

function createMockDb() {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  };
  return { db: chain, _chain: chain };
}

const mockLogger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
const mockAppLogger = { forContext: vi.fn().mockReturnValue(mockLogger) } as any;

function buildContent(overrides: Partial<RenderedNotification> = {}): RenderedNotification {
  return {
    title: 'New Assignment',
    body: 'You have been assigned to a task.',
    ...overrides,
  };
}

function buildContext(overrides: Partial<ChannelContext> = {}): ChannelContext {
  return {
    eventName: 'tasks.TaskAssigned',
    entityType: 'task',
    entityId: 'entity-123',
    correlationId: 'corr-abc',
    ...overrides,
  };
}

describe('InAppChannel', () => {
  let channel: InAppChannel;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    channel = new InAppChannel(mockDb as any, mockAppLogger);
  });

  it('should have channel set to "in_app"', () => {
    expect(channel.channel).toBe('in_app');
  });

  it('should create logger with InAppChannel context', () => {
    expect(mockAppLogger.forContext).toHaveBeenCalledWith('InAppChannel');
  });

  it('should insert a notification with correct fields', async () => {
    const content = buildContent();
    const context = buildContext();

    await channel.send('user-1', content, context);

    expect(mockDb._chain.insert).toHaveBeenCalled();
    expect(mockDb._chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        title: 'New Assignment',
        body: 'You have been assigned to a task.',
        eventName: 'tasks.TaskAssigned',
        entityType: 'task',
        entityId: 'entity-123',
      }),
    );
  });

  it('should call withTenantInsert with notifications table and data', async () => {
    const { withTenantInsert } = await import('@packages/tenancy/helpers');

    await channel.send('user-2', buildContent(), buildContext());

    expect(withTenantInsert).toHaveBeenCalledWith(
      expect.anything(), // notifications table
      expect.objectContaining({
        userId: 'user-2',
        title: 'New Assignment',
        body: 'You have been assigned to a task.',
        eventName: 'tasks.TaskAssigned',
        entityType: 'task',
        entityId: 'entity-123',
      }),
    );
  });

  it('should log debug message after insertion', async () => {
    const context = buildContext({ eventName: 'orders.OrderCreated' });

    await channel.send('user-3', buildContent(), context);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'In-app notification created',
      expect.objectContaining({
        channel: 'in_app',
        recipientId: 'user-3',
        eventName: 'orders.OrderCreated',
      }),
    );
  });

  it('should pass different content values through correctly', async () => {
    const content = buildContent({ title: 'Urgent Alert', body: '<b>Check now</b>' });
    const context = buildContext({ entityType: 'order', entityId: 'ord-999' });

    await channel.send('user-4', content, context);

    expect(mockDb._chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-4',
        title: 'Urgent Alert',
        body: '<b>Check now</b>',
        entityType: 'order',
        entityId: 'ord-999',
      }),
    );
  });

  it('should propagate database errors', async () => {
    mockDb._chain.values.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(
      channel.send('user-5', buildContent(), buildContext()),
    ).rejects.toThrow('DB connection lost');
  });

  it('should not log debug when insertion fails', async () => {
    mockDb._chain.values.mockRejectedValueOnce(new Error('Insert failed'));

    await expect(
      channel.send('user-6', buildContent(), buildContext()),
    ).rejects.toThrow('Insert failed');

    expect(mockLogger.debug).not.toHaveBeenCalled();
  });
});
